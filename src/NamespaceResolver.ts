import * as vscode from 'vscode'
import * as path from 'path'
import { statSync } from 'fs'

interface Prs4Entries {
    prefix: string
    path: string
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

        const psr4Entries: Prs4Entries[] = this.collectPsr4Entries(composer, "psr-4")
        const psr4namesp: string = this.NameSparePathPsr0(folder, composerFilePath.slice(0, -13), psr4Entries, 4)

        if (psr4namesp == "") {
            const psr0Entries: Prs4Entries[] = this.collectPsr4Entries(composer, "psr-0")
            return this.NameSparePathPsr0(folder, composerFilePath.slice(0, -13), psr0Entries, 0)
        }

        return psr4namesp
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

    private collectPsr4Entries(composer: any, psr4or0: string): Prs4Entries[] {
        let autoloadEntries: { [key: string]: string } = {}

        if (composer.hasOwnProperty("autoload") && composer.autoload.hasOwnProperty(psr4or0)) {
            autoloadEntries = composer.autoload[psr4or0]
        }

        let autoloadDevEntries: { [key: string]: string } = {}
        if (composer.hasOwnProperty("autoload-dev") && composer["autoload-dev"].hasOwnProperty(psr4or0)) {
            autoloadDevEntries = composer["autoload-dev"][psr4or0]
        }

        let psr4Entries: Prs4Entries[] = []

        this.pushTolist(psr4Entries, autoloadEntries)
        this.pushTolist(psr4Entries, autoloadDevEntries)

        return psr4Entries
    }

    private pushTolist(psr4Entries:Prs4Entries[], entries:{[key:string]: string}) {
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
    }

    private ootrim(str: string, char: string, type?: string): string {
        if (char) {
            if (type == 'left') {
                return str.replace(new RegExp('^\\' + char + '+', 'g'), '')
            } else if (type == 'right') {
                return str.replace(new RegExp('\\' + char + '+$', 'g'), '')
            }

            return str.replace(new RegExp('^\\' + char + '+|\\' + char + '+$', 'g'), '')
        }

        return str.replace(/^\s+|\s+$/g, '')
    }

    private NameSparePathPsr0(filePath: string, composerdir: string, Prs0ent: Prs4Entries[], prs:number): string {
        let enti: Prs4Entries = { path: "", prefix: "" }
        let current_dir:string = ""
        let srcIndex:number    = -1

        filePath    = this.ootrim(filePath, path.sep, "right") + path.sep

        for (const entip in Prs0ent) {
            enti = Prs0ent[entip]
            enti.prefix = this.ootrim(enti.prefix.trim(), '\\').trim()
            enti.path   = this.checkEmptyPath( this.ootrim(enti.path, '/') )

            if (enti.path.length > 0) {
                current_dir = composerdir + enti.path + path.sep
                if (enti.prefix.length > 0 && prs == 0) {
                    current_dir += enti.prefix.split('\\').join(path.sep) + path.sep;
                }
            } else {
                current_dir = composerdir
            }

            srcIndex = filePath.indexOf(current_dir)

            if (srcIndex == 0) {
                break
            }
        }

        if(srcIndex == -1) {
            return ""
        }

        let pathElements = this.ootrim( filePath,  path.sep, "right" ).slice(current_dir.length ).split(path.sep).join("\\").trim();
        let slash = ""

        if (enti.prefix.length > 0 && pathElements.length > 0) {
            slash = "\\"
        }

        return enti.prefix + slash + pathElements
    }

    private checkEmptyPath(path:string) {
        path = this.ootrim( path.trim(), "./", 'left')
        switch(path) {
            case '.':
            case '/':
            case './':
                return ""
            default:
                return path
        }
    }

}
