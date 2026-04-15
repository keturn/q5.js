const runPython = async function () {
	let scripts = [...document.getElementsByTagName('script')];
	scripts = scripts.filter((s) => s.type == 'q5-python' || s.type == 'text/q5-python');
	if (!scripts.length) return;

	if (!window.brython) {
		const loadScript = (src) =>
			new Promise((resolve, reject) => {
				const script = document.createElement('script');
				script.src = src;
				script.onload = resolve;
				script.onerror = reject;
				document.head.appendChild(script);
			});

		await loadScript('https://cdn.jsdelivr.net/npm/brython@3.12.0/brython.js');
		await loadScript('https://cdn.jsdelivr.net/npm/brython@3.12.0/brython_stdlib.min.js');
	}

	brython();

	__BRYTHON__.runPythonSource(`
from browser import window, aio

async def runQ5PY(code, q5py):
	ns = globals().copy()
	ns['ns'] = ns
	ns['q5py'] = q5py

	for attr in dir(q5py):
	  if not attr.startswith('_'):
		try:
			ns[attr] = getattr(q5py, attr)
		except Exception:
			pass

	exec(code, ns)
	
	if "__run_code" in ns:
	  await ns["__run_code"]()

window._runQ5PY = runQ5PY
`);

	let code = '';
	for (const script of scripts) {
		code += script.src ? await (await fetch(script.src)).text() : script.innerText;
	}

	const useWebGPU = !code.slice(0, code.indexOf('\n')).includes('C2D'),
		q5py = useWebGPU ? await Q5.WebGPU() : new Q5();

	code = code.replaceAll('\n', '\n\t');

	code = `
async def __run_code():
	pass

	${code}

	q5_state_vars = ["mouseX", "mouseY", "pmouseX", "pmouseY", "width", "height", "frameCount", "deltaTime", "mouseIsPressed", "mouseButton", "keyIsPressed", "key", "keyCode", "touches", "movedX", "movedY"]

	def _sync_and_call(fn):
		def _wrapper(*args):
			for _var in q5_state_vars:
				if hasattr(q5py, _var):
					ns[_var] = getattr(q5py, _var)
			return fn(*args)
		return _wrapper

	for _fn_name in ["update", "draw", "mousePressed", "mouseReleased", "mouseMoved", "mouseDragged", "mouseClicked", "doubleClicked", "mouseWheel", "keyPressed", "keyReleased", "keyTyped", "touchStarted", "touchMoved", "touchEnded", "windowResized"]:
		if _fn_name in locals():
			setattr(window, _fn_name, _sync_and_call(locals()[_fn_name]))
`;

	await window._runQ5PY(code, q5py);
};

if (typeof document == 'object') {
	if (document.readyState == 'loading') {
		document.addEventListener('DOMContentLoaded', runPython);
	} else runPython();
}
