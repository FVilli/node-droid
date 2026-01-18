import path from "path";
import { ENV } from "./env";

export async function delay(ms:number):Promise<void> {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export function getRepoPath(repoName:string) {
    return path.join(ENV.FOLDER_STORAGE, repoName);
}