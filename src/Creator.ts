import * as vscode from 'vscode'
import * as fs from 'fs'
import NamespaceResolver from './NamespaceResolver'
import path = require('path')
export default class Creator {
    readonly msgFileExists = "File already exists!"
    readonly msgMustOpenFile = 'You must open a file to generate code'

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

        let filename = name.endsWith('.php') ? name : name + '.php'
        
        let space_index: number = filename.indexOf(' ')
        if (space_index > 0) {
            filename = filename.substring(0, space_index) + '.php'
        }
        
        let fullFilename = folder.fsPath + path.sep + filename

        this.writeFile(type, name, fullFilename, namespace)
    }

    public async generateCode(type: string) {
        const currentFile  = vscode.window.activeTextEditor?.document.fileName
        
        if (!currentFile) {
            vscode.window.showErrorMessage(this.msgMustOpenFile)
            return
        }

        let namespaceResolver: NamespaceResolver = new NamespaceResolver()
        let namespace = await namespaceResolver.resolve(path.dirname(currentFile))

        if (namespace === undefined) {
            return
        }
        
        this.writeFile(type, path.basename(currentFile), currentFile, namespace, true)
    }

    private writeFile(type: string, name: string, filename: string, namespace: string|undefined, overwrite: boolean = false): void {
        if (fs.existsSync(filename) && !overwrite) {
            vscode.window.showErrorMessage(this.msgFileExists)
            return
        }
    
        name = name.replace(/\.php+$/g, "")
        
        let content = "<?php\n"

        if(vscode.workspace.getConfiguration("phpCreateClass").get("strictTypes")) {
            content += "\n"
            content += "declare(strict_types=1);\n"
        }

        content += "\n"

        if (namespace !== '' && namespace !== undefined) {
            content += "namespace " + namespace + ";\n"
            content += "\n"
        }
		
		if(vscode.workspace.getConfiguration("phpCreateClass").get("finalClass") && type === "class") {

            content += "final" + " " + type + " " + name + "\n";

        }else{

            content += type + " " + name + "\n";

        }
		
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
