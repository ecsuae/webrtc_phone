let _env = {
  userAgent: "",
  isAndroid: false,
  isIOS: false,
  isChromeIOS: false,
};

export function setRuntimeEnv(env) {
  _env = {
    userAgent: typeof env?.userAgent === "string" ? env.userAgent : "",
    isAndroid: !!env?.isAndroid,
    isIOS: !!env?.isIOS,
    isChromeIOS: !!env?.isChromeIOS,
  };
}

export function getRuntimeEnv() {
  return _env;
}

export function requireRuntimeEnv() {
  if (_env && typeof _env.userAgent === "string" && _env.userAgent) return _env;
  throw new Error("Runtime env not set");
}
