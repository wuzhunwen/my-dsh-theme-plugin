import { mkdir, readFile, writeFile } from 'node:fs/promises'

const body = await readFile(new URL('../dist/client.cjs', import.meta.url), 'utf8')
const wrapped = `window.__ModuleLoader__.load({ id: 'my-full-theme-plugin', factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
${body}
  return module.exports;
}});
`

await mkdir(new URL('../client/', import.meta.url), { recursive: true })
await writeFile(new URL('../client/client.js', import.meta.url), wrapped)