import { ExtensionContext, commands, window, env, TextEditor } from 'vscode';
import { parseJavaContext } from './java-parser';
import {
    generateWatchCommand,
    generateTraceCommand,
    generateStackCommand,
    generateMonitorCommand,
    generateTtCommand,
    generateJadCommand,
    generateScCommand,
    generateSmCommand
} from './arthas-commands';

export function activate(context: ExtensionContext) {
    const handleCommand = async (editor: TextEditor, generator: (ctx: any) => string, requireMethod: boolean) => {
        if (editor.document.languageId !== 'java') {
            window.showWarningMessage('Please open a Java file to use Arthas Helper.');
            return;
        }

        const position = editor.selection.active;
        const javaContext = await parseJavaContext(editor.document, position);

        if (!javaContext || !javaContext.className) {
            window.showErrorMessage('Could not determine class name from the current Java file.');
            return;
        }

        if (requireMethod && !javaContext.methodName) {
            window.showWarningMessage('Could not determine method name, the command might be incomplete.');
        }

        const commandStr = generator(javaContext);
        await env.clipboard.writeText(commandStr);
        window.showInformationMessage(`Arthas command copied: ${commandStr}`);
    };

    const register = (commandId: string, generator: (ctx: any) => string, requireMethod: boolean = false) => {
        const cmd = commands.registerTextEditorCommand(commandId, (editor) => {
            handleCommand(editor, generator, requireMethod);
        });
        context.subscriptions.push(cmd);
    };

    register('arthasHelper.watch', generateWatchCommand, true);
    register('arthasHelper.trace', generateTraceCommand, true);
    register('arthasHelper.stack', generateStackCommand, true);
    register('arthasHelper.monitor', generateMonitorCommand, true);
    register('arthasHelper.tt', generateTtCommand, true);
    register('arthasHelper.jad', generateJadCommand, false);
    register('arthasHelper.sc', generateScCommand, false);
    register('arthasHelper.sm', generateSmCommand, true);
}

export function deactivate() {}
