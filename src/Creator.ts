import * as vscode from 'vscode'
import * as fs from 'fs'
import NamespaceResolver from './NamespaceResolver'
import path = require('path')
export default class Creator {
    readonly msgFileExists = "File already exists!"

    public async createFile(type: string, folder: any) {
        if (!folder) {
            let askedFolder = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false
            })

            if (!askedFolder || !askedFolder[0]) {
                return
            }

            folder = askedFolder[0]
        }

        let name = await vscode.window.showInputBox({
            title: "New PHP " + this.capitalize(type),
            placeHolder: "Name",
            prompt: "Name of " + type
        })

        if (!name) {
            return
        }

        let namespaceResolver: NamespaceResolver = new NamespaceResolver()
        let namespace = await namespaceResolver.resolve(folder.fsPath)

        if (namespace === undefined) {
            return
        }

        let filename = name.endsWith('.php') ? name : name + '.php'
        
        let space_index: number = filename.indexOf(' ')
        if (space_index > 0) {
            filename = filename.substring(0, space_index) + '.php'
        }
        
        let fullFilename = folder.fsPath + path.sep + filename

        this.writeFile(type, name, fullFilename, namespace)
    }

    private writeFile(type: string, name: string, filename: string, namespace: string): void {
        if (fs.existsSync(filename)) {
            vscode.window.showErrorMessage(this.msgFileExists)
            return
        }

        let content = "<?php\n"

        if(vscode.workspace.getConfiguration("phpCreateClass").get("strict_types")) {
            content += "\n"
            content += "declare(strict_types=1);\n"
        }

        content += "\n"
        content += "namespace " + namespace + ";\n"
        content += "\n"
        content += type + " " + name + "\n"
        content += "{\n\n}\n"

        fs.writeFileSync(filename, content)

        vscode.workspace.openTextDocument(vscode.Uri.file(filename)).then(file => {
            vscode.window.showTextDocument(file)
        })
    }

    private capitalize(text: string): string {
        return text.charAt(0).toUpperCase() + text.slice(1)
    }
}
