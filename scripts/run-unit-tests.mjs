import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
async function discover(folder) {
  const files=[];
  for(const entry of await fs.readdir(folder,{withFileTypes:true})){
    const filename=path.join(folder,entry.name);
    if(entry.isDirectory())files.push(...await discover(filename));
    else if(entry.isFile()&&entry.name.endsWith(".test.mjs"))files.push(filename);
  }
  return files;
}
const files=await discover("src");
if(!files.length)throw new Error("No domain/API unit tests found");
// Import paths as file URLs so Next.js folders like [id] are not interpreted as globs.
for(const filename of files.sort())await import(pathToFileURL(path.resolve(filename)).href);
