import * as vscode from 'vscode'
import * as path from 'path'
import { statSync, existsSync } from 'fs'

interface PsrEntry {
    ns: string
    path: string,
    type: string
}

interface PathMatches {
    path: string
    prefix: string
    length: number,
    priority: number
}

export default class NamespaceResolver {
    readonly msgCouldNotBeRead = "The composer.json file could not be read"
    readonly msgNamespaceNotResolved = "The namespace could not be resolved"
    readonly msgCouldNotBeFound = "The composer.json file could not be found"

    public async resolve(folder: string): Promise<string | undefined> {
        const {composerFolder, composerPath, composerFound} = this.findComposerFile(folder)

        if (!composerFound) {
            await vscode.window.showErrorMessage(this.msgCouldNotBeFound)
            return undefined
        }

        let composer = await this.composerContent(composerPath)

        if (!composer) {
            await vscode.window.showErrorMessage(this.msgCouldNotBeRead)
            return undefined
        }

        const psrEntries: PsrEntry[] = this.collectPsrEntries(composer);
        let pathMatches: PathMatches[] = []
        
        for (const entry of psrEntries) {
            const pathNoLastSlash = this.removeLastPathSeparator(entry.path)
            entry.path = this.ensurePathEndsWithSlash(entry.path)

            const resolvedPath = path.resolve(composerFolder, pathNoLastSlash);

            if (folder.indexOf(resolvedPath) != -1) {
                pathMatches.push({
                    path: this.ensurePathEndsWithSlash(resolvedPath),
                    prefix: this.normalizeNamespace(entry.ns),
                    length: resolvedPath.length,
                    priority: entry.type == 'psr-4' ? 1 : 0
                })
            }
        }

        if (pathMatches.length == 0) {
            await vscode.window.showErrorMessage(this.msgNamespaceNotResolved);
            return '';
        }

        pathMatches.sort((a, b) => {
            return b.length - a.length
        })

        pathMatches.sort((a, b) => {
            return b.priority - a.priority
        })

        const finalFolder = this.ensurePathEndsWithSlash(folder);

        let resolved = finalFolder
            .replace(pathMatches[0].path, pathMatches[0].prefix)
            .replace(/\//g, '\\');

        return this.removeLastPathSeparator(resolved);
    }

    private removeLastPathSeparator(nsPath: string): string {
        if (nsPath.endsWith('/') || nsPath.endsWith('\\')) {
            return nsPath.slice(0, -1)
        }

        return nsPath
    }

    private normalizeNamespace(ns: string): string {
        if (!ns.endsWith('\\')) {
            ns += '\\';
        }

        if (ns.startsWith('/') || ns.startsWith('\\')) {
            ns = ns.slice(1);
        }

        return ns;
    }

    private ensurePathEndsWithSlash(path: string) {
        if (!path.endsWith('/')) {
            path += '/';
        }

        return path;
    }

    private ensureEndsWithSystemSeparator(folder: string): string {
        if (!folder.endsWith(path.sep)) {
            folder += path.sep;
        }

        return folder;
    }

    private async composerContent(composerFilePath: string) {
        try {
            let composerContent: string = (await vscode.workspace.openTextDocument(composerFilePath)).getText()
            return JSON.parse(composerContent)
        } catch (error) {
            return undefined
        }
    }

    private findComposerFile(folder: string): any {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(folder))?.uri.fsPath as string;
        const composerFilePath = vscode.workspace.getConfiguration("phpCreateClass").get("composerFilePath") as string;
        
        if (composerFilePath !== null && composerFilePath !== '') {
            return this.parseComposerFilePath(composerFilePath, workspaceFolder);
        }
        
        
        let segments = folder.split(path.sep)
        let walking = true

        do {
            const composerFolder = segments.join(path.sep)

            try {
                const composerPath = path.join(composerFolder, 'composer.json')
                statSync(composerPath)

                return {
                    composerFolder: this.ensureEndsWithSystemSeparator(composerFolder),
                    composerPath, 
                    composerFound: true
                }
            } catch {
                segments.pop()
            }

            if (composerFolder == workspaceFolder) {
                walking = false
            }
        } while (walking)

        return {composerFound: false}
    }

    private collectPsrEntries(composer: any): PsrEntry[] {
        const autoloads = ['autoload', 'autoload-dev'];
        const psrs = ['psr-4', 'psr-0'];
        let psrEntries: PsrEntry[] = []

        for (let autoload of autoloads) {
            if (!composer.hasOwnProperty(autoload)) {
                continue;
            }

            for (let psr of psrs) {
                if (!composer[autoload].hasOwnProperty(psr)) {
                    continue;
                }

                for (let ns in composer[autoload][psr]) {
                    let path  = composer[autoload][psr][ns];
                    path = this.ensurePathEndsWithSlash(path)

                    psrEntries.push({
                        ns: ns,
                        path: path,
                        type: psr
                    });
                }
            }
        }

        return psrEntries;
    }

    private parseComposerFilePath(composerFilePath: string, workspaceFolder: string): any {
        const folder = path.join(workspaceFolder || '', composerFilePath);
        const parsedPath = path.parse(folder);

        if (parsedPath.ext === '.json') {
            return {
                composerFolder: this.ensureEndsWithSystemSeparator(path.dirname(folder)),
                composerPath: folder,
                composerFound: true
            };
        }

        const filePath = path.join(folder, 'composer.json');

        if (!existsSync(filePath)) {
            return {composerFound: false};
        }

        return {
            composerFolder: this.ensureEndsWithSystemSeparator(folder),
            composerPath: filePath,
            composerFound: true
        };
    }
}
