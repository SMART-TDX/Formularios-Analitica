import fs from "node:fs/promises";
import path from "node:path";

const source = "C:/Users/SMART/Downloads/Manual caso de uso - Migui avatar actualizado v9.html";
const mascot = "C:/Users/SMART/Documents/Codex/2026-09-03/br/outputs/manual_caso_negocio_pulpito/pulpito-migui-transparente.png";
const outputDir = "C:/Users/SMART/Documents/Codex/2026-09-03/br/outputs/manual_caso_negocio_pulpito";
const output = path.join(outputDir, "Manual_caso_de_negocio_SmartIA_Pulpito.html");

await fs.mkdir(outputDir, { recursive: true });
const html = await fs.readFile(source, "utf8");
const image = await fs.readFile(mascot);
const dataUrl = `data:image/png;base64,${image.toString("base64")}`;

const mainPattern = /--migui:url\("data:image\/[a-zA-Z0-9.+-]+;base64,[^"]+"\)/;
const flowPattern = /--migui-flow:url\("data:image\/[a-zA-Z0-9.+-]+;base64,[^"]+"\)/;
const wordmarkContentPattern = /(\.brand-wordmark-img\s*\{\s*content:url\(")data:image\/[a-zA-Z0-9.+-]+;base64,[^"]+("\))/;
const brandIconPattern = /(\.brand:before\s*\{[\s\S]*?background-image:url\(")data:image\/[a-zA-Z0-9.+-]+;base64,[^"]+("\))/;
const wordmarkImgPattern = /(<img\s+class="brand-wordmark-img"\s+src=")data:image\/[a-zA-Z0-9.+-]+;base64,[^"]+("\s+alt="Migui">)/;
if (!mainPattern.test(html) || !flowPattern.test(html) || !wordmarkImgPattern.test(html)) {
  throw new Error("No se encontraron todas las imágenes de Migui esperadas en el HTML.");
}

const updated = html
  .replace(mainPattern, `--migui:url("${dataUrl}")`)
  .replace(flowPattern, `--migui-flow:url("${dataUrl}")`)
  .replace(wordmarkContentPattern, `$1${dataUrl}$2`)
  .replace(brandIconPattern, `$1${dataUrl}$2`)
  .replace(wordmarkImgPattern, `$1${dataUrl}$2`)
  .replace(/\.brand-wordmark-img\{display:block;width:112px;height:auto;margin-left:10px;mix-blend-mode:multiply;object-fit:contain\}/,
    ".brand-wordmark-img{display:block;width:64px;height:64px;margin-left:10px;mix-blend-mode:normal;object-fit:contain}")
  .replace(/@media\(max-width:640px\)\{\.brand-wordmark-img\{width:94px;margin-left:8px\}\}/,
    "@media(max-width:640px){.brand-wordmark-img{width:54px;height:54px;margin-left:8px}}")
  .replace("</head>", "<style>.nav .brand,.nav .brand-wordmark-img{display:none!important}</style></head>")
  .replace("<!-- Versión 7: imagen original del wordmark Migui junto al logo. -->", "<!-- Versión SmartIA: avatar del pulpito integrado con fondo transparente. -->");

await fs.writeFile(output, updated, "utf8");
console.log(output);
