// One banner element per kind, built to the markup contract shared with the stylesheet:
//   <div class="ins-banner" data-ins-banner="offline|idle" role="status|alertdialog">
//     <span class="ins-banner-text"></span>
//     <button class="btn btn-sm btn-default ins-banner-action"></button>   (optional)
//   </div>
// inserted as the first child of body. Found again on every call, created once. No core markup is
// touched; the button's handler is attached to the button this module created.
const BANNER_CLASS = "ins-banner";
const TEXT_CLASS = "ins-banner-text";
const ACTION_CLASS = "ins-banner-action";
let counter = 0;

export function findBanner(kind) {
	if (!document.body) return null;
	for (const child of document.body.children) {
		if (child.classList.contains(BANNER_CLASS) && child.getAttribute("data-ins-banner") === kind) return child;
	}
	return null;
}

function build(kind) {
	const banner = document.createElement("div");
	banner.className = BANNER_CLASS;
	banner.setAttribute("data-ins-banner", kind);
	const text = document.createElement("span");
	text.className = TEXT_CLASS;
	counter += 1;
	text.id = "ins-banner-text-" + counter;
	banner.appendChild(text);
	if (kind === "idle") {
		banner.setAttribute("role", "alertdialog");
		banner.setAttribute("aria-labelledby", text.id);
	} else {
		banner.setAttribute("role", "status");
	}
	document.body.insertBefore(banner, document.body.firstChild);
	return banner;
}

// Shows or updates the banner. `action` is `{ label, onClick }` or omitted for a banner without a button.
export function showBanner(kind, message, action) {
	if (!document.body) return null;
	const banner = findBanner(kind) || build(kind);
	const text = banner.querySelector("." + TEXT_CLASS);
	if (text.textContent !== message) text.textContent = message;
	let button = banner.querySelector("." + ACTION_CLASS);
	if (!action) {
		if (button) button.remove();
		return banner;
	}
	if (!button) {
		button = document.createElement("button");
		button.type = "button";
		button.className = "btn btn-sm btn-default " + ACTION_CLASS;
		banner.appendChild(button);
	}
	if (button.textContent !== action.label) button.textContent = action.label;
	button.onclick = action.onClick;
	return banner;
}

export function hideBanner(kind) {
	const banner = findBanner(kind);
	if (banner) banner.remove();
}
