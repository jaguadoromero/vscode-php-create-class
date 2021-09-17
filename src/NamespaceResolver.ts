import * as vscode from 'vscode'
import * as path from 'path'

interface Prs4Entries {
    prefix: string
    path: string
}

interface NamespaceMatches {
    path: string
    prefix: string
    length: number
}

export default class NamespaceResolver {
    readonly msgCouldNotBeRead = "The composer.json file could not be read"
    readonly msgNamespaceNotResolved = "The namespace could not be resolved"

    public async resolve(folder: string): Promise<string | undefined> {
        let relativePath = vscode.workspace.asRelativePath(folder)

        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders?.length > 1) {
            relativePath = relativePath.split('/').slice(1).join('/')
        }

        let composer = await this.composerContent(folder)
        if (!composer || !composer.autoload) {
            vscode.window.showErrorMessage(this.msgCouldNotBeRead)
            return undefined
        }
        
        const entries = {...composer.autoload["psr-4"] ?? {}, ...composer["autoload-dev"]["psr-4"] ?? {}}
        const psr4Entries: Prs4Entries[] = this.collectPsr4Entries(entries)
        
        let namespaceMatches: NamespaceMatches[] = []
        for (const ns of psr4Entries) {
            let nsPath = this.removeLastPathSeparator(ns.path)

            if (relativePath.indexOf(nsPath) != -1) {
                namespaceMatches.push({
                    path: ns.path,
                    prefix: ns.prefix,
                    length: ns.path.length,
                })
            }
        }
        
        if (namespaceMatches.length == 0) {
            vscode.window.showErrorMessage(this.msgNamespaceNotResolved)
            return ''
        }

        namespaceMatches.sort((a, b) => {
            return b.length - a.length
        })

        relativePath += '/'

        let resolved = relativePath
            .replace(namespaceMatches[0].path, namespaceMatches[0].prefix)
            .replace(/\//g, '\\')

        return this.removeLastPathSeparator(resolved)
    }

    private async composerContent(folder: string) {
        let composerContent: string

        try {
            let root = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(folder))?.uri.fsPath
            composerContent = await (await vscode.workspace.openTextDocument(root + path.sep + 'composer.json')).getText()
        } catch (error) {
            vscode.window.showErrorMessage(this.msgCouldNotBeRead)
            return
        }

        return JSON.parse(composerContent)
    }

    private collectPsr4Entries(entries: any) :Prs4Entries[] {
        let psr4Entries: Prs4Entries[] = []

        for (const prefix in entries) {
            const path = entries[prefix]

            if (Array.isArray(path)) {
                for (const prefixPath of path) {
                    psr4Entries.push({prefix: prefix, path: prefixPath})
                }
            } else {
                psr4Entries.push({prefix, path})
            }
        }

        return psr4Entries
    } 

    private removeLastPathSeparator(nsPath: string): string {
        if (nsPath.endsWith('/') || nsPath.endsWith('\\')) {
            return nsPath.slice(0, -1)
        }

        return nsPath
    }
}