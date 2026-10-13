#!/usr/bin/env node
// Runs the Midad build, or a one-turn smoke test, with Claude in GitHub Actions.
//
// The key comes from ANTHROPIC_API_KEY and is never printed. Two engines:
//   sdk  the Claude Agent SDK (@anthropic-ai/claude-agent-sdk), the default;
//   cli  `claude -p` from @anthropic-ai/claude-code, kept as a fallback.
// Both print the same compact log and exit 1 unless the run ends in success.
//
// Usage:
//   node tools/ci/run_agent.mjs --smoke [--engine sdk|cli] [--model M]
//   node tools/ci/run_agent.mjs [--engine sdk|cli] [--model M] [--max-turns N]
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
	options: {
		engine: { type: "string", default: "sdk" },
		smoke: { type: "boolean", default: false },
		model: { type: "string", default: "opus" },
		"max-turns": { type: "string", default: "2000" },
	},
});

const TOOLS = ["Bash", "Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "Task", "Agent", "TodoWrite", "WebFetch"];
const SMOKE_PROMPT = "Reply with the single word OK.";
const BUILD_PROMPT =
	"Read docs/team/RESUME_PROMPT.md in this repository and follow it exactly, from the first step to the final report.";

function cut(value, limit) {
	const text = String(value ?? "");
	return text.length > limit ? `${text.slice(0, limit)} …(+${text.length - limit} chars)` : text;
}

function show(msg) {
	if (msg.type === "system" && msg.subtype === "init") {
		console.log(`[init] model=${msg.model} tools=${(msg.tools ?? []).length} agents=${(msg.agents ?? []).join(",")}`);
	} else if (msg.type === "assistant") {
		const who = msg.parent_tool_use_id ? "agent" : "lead";
		for (const block of msg.message?.content ?? []) {
			if (block.type === "text" && block.text.trim()) console.log(`[${who}] ${cut(block.text, 1500)}`);
			if (block.type === "tool_use") console.log(`[${who} tool] ${block.name} ${cut(JSON.stringify(block.input), 400)}`);
		}
	} else if (msg.type === "user" && Array.isArray(msg.message?.content)) {
		for (const block of msg.message.content) {
			if (block.type !== "tool_result") continue;
			const text = Array.isArray(block.content) ? block.content.map((c) => c.text ?? "").join(" ") : block.content;
			console.log(`[tool result${block.is_error ? " ERROR" : ""}] ${cut(text, 300)}`);
		}
	} else if (msg.type === "result") {
		console.log(
			`[done] subtype=${msg.subtype} is_error=${msg.is_error} turns=${msg.num_turns} cost_usd=${msg.total_cost_usd} result=${cut(msg.result, 3000)}`,
		);
		if (msg.modelUsage) console.log(`[usage] ${JSON.stringify(msg.modelUsage)}`);
	}
}

async function runSdk(prompt) {
	const { query } = await import("@anthropic-ai/claude-agent-sdk");
	const options = args.smoke
		? { model: args.model, maxTurns: 1, allowedTools: [], settingSources: [] }
		: {
				model: args.model,
				maxTurns: Number(args["max-turns"]),
				allowedTools: TOOLS,
				permissionMode: "acceptEdits",
				systemPrompt: { type: "preset", preset: "claude_code" },
				// Loads CLAUDE.md and the seven agents in .claude/agents/.
				settingSources: ["project", "local"],
				cwd: process.cwd(),
				stderr: (data) => process.stderr.write(data),
			};
	let final;
	for await (const msg of query({ prompt, options })) {
		show(msg);
		if (msg.type === "result") final = msg;
	}
	return final;
}

function runCli(prompt) {
	const cliArgs = ["-y", "@anthropic-ai/claude-code@latest", "-p", prompt, "--model", args.model];
	cliArgs.push("--output-format", "stream-json", "--verbose", "--max-turns", args.smoke ? "1" : args["max-turns"]);
	if (!args.smoke) cliArgs.push("--allowedTools", TOOLS.join(","), "--permission-mode", "acceptEdits");
	return new Promise((resolve) => {
		const child = spawn("npx", cliArgs, { stdio: ["ignore", "pipe", "inherit"] });
		let final;
		let buffer = "";
		child.stdout.on("data", (chunk) => {
			buffer += chunk;
			let newline = buffer.indexOf("\n");
			while (newline >= 0) {
				const line = buffer.slice(0, newline).trim();
				buffer = buffer.slice(newline + 1);
				if (line) {
					try {
						const msg = JSON.parse(line);
						show(msg);
						if (msg.type === "result") final = msg;
					} catch {
						console.log(line);
					}
				}
				newline = buffer.indexOf("\n");
			}
		});
		child.on("close", () => resolve(final));
	});
}

// A secret pasted with a stray space or newline still authenticates over HTTP but not everywhere.
process.env.ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY ?? "").trim();
if (!process.env.ANTHROPIC_API_KEY) {
	console.error("::error::ANTHROPIC_API_KEY is not set.");
	process.exit(1);
}

const prompt = args.smoke ? SMOKE_PROMPT : BUILD_PROMPT;
let final;
try {
	final = args.engine === "cli" ? await runCli(prompt) : await runSdk(prompt);
} catch (error) {
	console.error(`::error::The ${args.engine} engine stopped: ${cut(error?.message ?? error, 2000)}`);
	process.exit(1);
}
if (!final) {
	console.error(`::error::The ${args.engine} engine ended without a result message.`);
	process.exit(1);
}
if (final.is_error || final.subtype !== "success") {
	if (/credit balance/i.test(String(final.result ?? ""))) {
		console.error(`::error::"${final.result}": requests from the ${args.engine} engine are not covered by this key's credits.`);
	}
	process.exit(1);
}
if (args.smoke) {
	console.log(`Smoke test passed with the ${args.engine} engine (cost ${final.total_cost_usd} USD, charged to the available credits).`);
}
