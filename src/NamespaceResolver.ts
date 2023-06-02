import * as vscode from 'vscode'
import * as path from 'path'
import { statSync } from 'fs'

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

        let relativePath = folder
            .replace(composerFolder, '')
            .replace(/\\/g, '/');

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

            if (relativePath.indexOf(pathNoLastSlash) != -1) {
                if (entry.type == 'psr-0' && entry.ns == '') {
                    entry.ns = relativePath
                        .replace(entry.path, '')
                        .replace(/\//g, '\\');
                    entry.path = relativePath + '/';
                }

                pathMatches.push({
                    path: this.ensurePathEndsWithSlash(entry.path),
                    prefix: this.ensureNamespaceEndsWithDoubleBackslash(entry.ns),
                    length: entry.path.length,
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

        const finalFolder = this.ensurePathEndsWithSlash(relativePath);

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

    private ensureNamespaceEndsWithDoubleBackslash(ns: string): string {
        if (!ns.endsWith('\\')) {
            ns += '\\';
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
        let workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(folder))?.uri.fsPath
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
                    
                    if (psr == 'psr-0') {
                        path += ns.replace(/\\/g, "/");
                    } 

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
}
