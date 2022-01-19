import * as vscode from 'vscode'
import * as path from 'path'
import { statSync } from 'fs'

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

        const psr4Entries: Prs4Entries[] = this.collectPsr4Entries(composer)

        let namespaceMatches: NamespaceMatches[] = []
        for (const ns of psr4Entries) {
            let nsPath = this.removeLastPathSeparator(ns.path)

            if (relativePath.indexOf(nsPath) != -1) {
                namespaceMatches.push({
                    path: ns.path,
                    prefix: ns.prefix,
                    length: ns.path.length
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

        let finalFolder = path.join(folder, path.sep).replace(path.join(path.dirname(composerFilePath), path.sep), '')
        let namespacePath = this.normalizeNamespacePath(namespaceMatches[0].path)

        let resolved = finalFolder
            .replace(namespacePath, namespaceMatches[0].prefix)
            .replace(/\//g, '\\')

        return this.removeLastPathSeparator(resolved)
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

    private collectPsr4Entries(composer: any): Prs4Entries[] {
        let autoloadEntries: { [key: string]: string } = {}

        if (composer.hasOwnProperty("autoload") && composer.autoload.hasOwnProperty("psr-4")) {
            autoloadEntries = composer.autoload["psr-4"]
        }

        let autoloadDevEntries: { [key: string]: string } = {}
        if (composer.hasOwnProperty("autoload-dev") && composer["autoload-dev"].hasOwnProperty("psr-4")) {
            autoloadDevEntries = composer["autoload-dev"]["psr-4"]
        }

        const entries = { ...autoloadEntries, ...autoloadDevEntries }

        let psr4Entries: Prs4Entries[] = []

        for (const prefix in entries) {
            const entryPath = entries[prefix]

            if (Array.isArray(entryPath)) {
                for (const prefixPath of entryPath) {
                    psr4Entries.push({ prefix: prefix, path: prefixPath })
                }
            } else {
                psr4Entries.push({ prefix: prefix, path: entryPath })
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

    private normalizeNamespacePath(nsPath: string): string {
        if (!nsPath.endsWith('/')) {
            nsPath += '/'
        }

        return nsPath.replace(/\//g, path.sep)
    }
}