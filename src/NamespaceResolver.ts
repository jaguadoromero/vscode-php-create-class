"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs_1 = require("fs");
class NamespaceResolver {
    constructor() {
        this.msgCouldNotBeRead = "The composer.json file could not be read";
        this.msgNamespaceNotResolved = "The namespace could not be resolved";
        this.msgCouldNotBeFound = "The composer.json file could not be found";
    }
    resolve(folder) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let relativePath = vscode.workspace.asRelativePath(folder);
            if (vscode.workspace.workspaceFolders && ((_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a.length) > 1) {
                relativePath = relativePath.split('/').slice(1).join('/');
            }
            let composerFilePath = this.findComposerFile(folder);
            if (!composerFilePath) {
                vscode.window.showErrorMessage(this.msgCouldNotBeFound);
                return undefined;
            }
            let composer = yield this.composerContent(composerFilePath);
            if (!composer) {
                vscode.window.showErrorMessage(this.msgCouldNotBeRead);
                return undefined;
            }
            const psr4Entries = this.collectPsr4Entries(composer);
            let namespaceMatches = [];
            for (const ns of psr4Entries) {
                let nsPath = this.removeLastPathSeparator(ns.path);
                if (relativePath.indexOf(nsPath) != -1) {
                    namespaceMatches.push({
                        path: ns.path,
                        prefix: ns.prefix,
                        length: ns.path.length
                    });
                }
            }
            if (namespaceMatches.length == 0) {
                const psr0Entries = this.collectPsr0Entries(composer);
                return this.NameSparePathPsr0(folder, composerFilePath.slice(0, -13), psr0Entries);
            }
            namespaceMatches.sort((a, b) => {
                return b.length - a.length;
            });
            let finalFolder = path.join(folder, path.sep).replace(path.join(path.dirname(composerFilePath), path.sep), '');
            let namespacePath = this.normalizeNamespacePath(namespaceMatches[0].path);
            let resolved = finalFolder
                .replace(namespacePath, namespaceMatches[0].prefix)
                .replace(/\//g, '\\');
            return this.removeLastPathSeparator(resolved);
        });
    }
    composerContent(composerFilePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let composerContent = (yield vscode.workspace.openTextDocument(composerFilePath)).getText();
                return JSON.parse(composerContent);
            }
            catch (error) {
                return undefined;
            }
        });
    }
    findComposerFile(folder) {
        var _a;
        let workspaceFolder = (_a = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(folder))) === null || _a === void 0 ? void 0 : _a.uri.fsPath;
        let segments = folder.split(path.sep);
        let walking = true;
        do {
            const fullPath = segments.join(path.sep);
            try {
                const composerPath = path.join(fullPath, 'composer.json');
                fs_1.statSync(composerPath);
                return composerPath;
            }
            catch (_b) {
                segments.pop();
            }
            if (fullPath == workspaceFolder) {
                walking = false;
            }
        } while (walking);
        return undefined;
    }
    collectPsr4Entries(composer) {
        let autoloadEntries = {};
        if (composer.hasOwnProperty("autoload") && composer.autoload.hasOwnProperty("psr-4")) {
            autoloadEntries = composer.autoload["psr-4"];
        }
        let autoloadDevEntries = {};
        if (composer.hasOwnProperty("autoload-dev") && composer["autoload-dev"].hasOwnProperty("psr-4")) {
            autoloadDevEntries = composer["autoload-dev"]["psr-4"];
        }
        const entries = Object.assign(Object.assign({}, autoloadEntries), autoloadDevEntries);
        let psr4Entries = [];
        for (const prefix in entries) {
            const entryPath = entries[prefix];
            if (Array.isArray(entryPath)) {
                for (const prefixPath of entryPath) {
                    psr4Entries.push({ prefix: prefix, path: prefixPath });
                }
            }
            else {
                psr4Entries.push({ prefix: prefix, path: entryPath });
            }
        }
        return psr4Entries;
    }


     collectPsr0Entries(composer) {
        let autoloadEntries = {};
        if (composer.hasOwnProperty("autoload") && composer.autoload.hasOwnProperty("psr-0")) {
            autoloadEntries = composer.autoload["psr-0"];
        }
        let autoloadDevEntries = {};
        if (composer.hasOwnProperty("autoload-dev") && composer["autoload-dev"].hasOwnProperty("psr-0")) {
            autoloadDevEntries = composer["autoload-dev"]["psr-0"];
        }
        const entries = Object.assign(Object.assign({}, autoloadEntries), autoloadDevEntries);
        let psr4Entries = [];
        for (const prefix in entries) {
            const entryPath = entries[prefix];
            if (Array.isArray(entryPath)) {
                for (const prefixPath of entryPath) {
                    psr4Entries.push({ prefix: prefix, path: prefixPath });
                }
            }
            else {
                psr4Entries.push({ prefix: prefix, path: entryPath });
            }
        }
        return psr4Entries;
    }
  

       ootrim(str, char, type) {
        if (char) {
            if (type == 'left') {
                return str.replace(new RegExp('^\\' + char + '+', 'g'), '');
            }
            else if (type == 'right') {
                return str.replace(new RegExp('\\' + char + '+$', 'g'), '');
            }
            return str.replace(new RegExp('^\\' + char + '+|\\' + char + '+$', 'g'), '');
        }
        return str.replace(/^\s+|\s+$/g, '');
    }

    
    NameSparePathPsr0(filePath, composerdir, Prs0ent) {
        let enti = { path: "", prefix: "" };
        let current_dir = "";
        for (const entip in Prs0ent) {
            enti = Prs0ent[entip];
            enti.prefix = this.ootrim(enti.prefix.trim(), '\\').trim();
            if (enti.path.length > 0) {
                current_dir = composerdir + this.ootrim(enti.path, '/') + path.sep + enti.prefix.replace('\\', path.sep) + path.sep;
            }
            else {
                current_dir = composerdir;
            }
            const srcIndex = filePath.indexOf(current_dir);
            if (srcIndex == 0) {
                break;
            }
        }
        let pathElements = filePath.slice(current_dir.length).trim().split(path.sep).join("\\").trim();
        let slash = "";
        if (enti.prefix.length > 0 && pathElements.length > 0) {
            slash = "\\";
        }
        return enti.prefix + slash + pathElements;
    }

   


    removeLastPathSeparator(nsPath) {
        if (nsPath.endsWith('/') || nsPath.endsWith('\\')) {
            return nsPath.slice(0, -1);
        }
        return nsPath;
    }
    normalizeNamespacePath(nsPath) {
        if (!nsPath.endsWith('/')) {
            nsPath += '/';
        }
        return nsPath.replace(/\//g, path.sep);
    }
}
exports.default = NamespaceResolver;
//# sourceMappingURL=NamespaceResolver.js.map
