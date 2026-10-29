const load = async () => {
  const mod = await import("./dynamic-import-target.mjs");
  return mod;
};

export { load };
