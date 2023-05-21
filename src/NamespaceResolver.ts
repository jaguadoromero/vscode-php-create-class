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
        let relativePath = vscode.workspace.asRelativePath(folder)

        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders?.length > 1) {
            relativePath = relativePath.split('/').slice(1).join('/')
        }

        let composerFilePath = this.findComposerFile(folder)
        
        if (!composerFilePath) {
            vscode.window.showErrorMessage(this.msgCouldNotBeFound)
            return undefined
        }

        let composer = await this.composerContent(composerFilePath)

        if (!composer) {
            vscode.window.showErrorMessage(this.msgCouldNotBeRead)
            return undefined
        }

        const psrEntries: PsrEntry[] = this.collectPsrEntries(composer);
        let pathMatches: PathMatches[] = []

        for (const entry of psrEntries) {
            let nsPath = this.removeLastPathSeparator(entry.path);

            if (relativePath.indexOf(nsPath) != -1) {
                if (entry.type == 'psr-0' && entry.ns == '') {
                    entry.ns = relativePath
                        .replace(entry.path, '')
                        .replace(/\//g, '\\');
                    entry.path = relativePath + '/';
                }

                pathMatches.push({
                    path: entry.path,
                    prefix: this.ensureNamespaceEndsWithDoubleBackslash(entry.ns),
                    length: entry.path.length,
                    priority: entry.type == 'psr-4' ? 1 : 0
                })
            }
        }

        if (pathMatches.length == 0) {
            vscode.window.showErrorMessage(this.msgNamespaceNotResolved);
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

    private async composerContent(composerFilePath: string) {
        try {
            let composerContent: string = (await vscode.workspace.openTextDocument(composerFilePath)).getText()
            return JSON.parse(composerContent)
        } catch (error) {
            return undefined
        }
    }

    private findComposerFile(folder: string): string | undefined {
        let workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(folder))?.uri.fsPath
        let segments = folder.split(path.sep)

        let walking = true

        do {
            const fullPath = segments.join(path.sep)

            try {
                const composerPath = path.join(fullPath, 'composer.json')
                statSync(composerPath)

                return composerPath
            } catch {
                segments.pop()
            }

            if (fullPath == workspaceFolder) {
                walking = false
            }
        } while (walking)

        return undefined
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

                    
                    if (psr == 'psr-0') {
                        path += '/' + ns.replace(/\\/g, "/");
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
