import { NodeIO } from "@gltf-transform/core";

const [, , input, output] = process.argv;

if (!input || !output) {
  console.error("Usage: node strip-attrs.mjs <input.glb> <output.glb>");
  process.exit(1);
}

const io = new NodeIO();
const doc = await io.read(input);

for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    // UVs: you have no textures, so this is safe and helps weld/simplify.
    const uv0 = prim.getAttribute("TEXCOORD_0");
    if (uv0) uv0.dispose();

    // Normals: removing them lets weld/simplify be more aggressive.
    // We'll regenerate normals after simplification.
    const n = prim.getAttribute("NORMAL");
    if (n) n.dispose();
  }
}

await io.write(output, doc);
console.log(`Wrote: ${output}`);
