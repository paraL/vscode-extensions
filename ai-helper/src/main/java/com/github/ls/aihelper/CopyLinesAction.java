package com.github.ls.aihelper;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.actionSystem.CommonDataKeys;
import com.intellij.openapi.editor.Document;
import com.intellij.openapi.editor.Editor;
import com.intellij.openapi.editor.SelectionModel;
import com.intellij.openapi.ide.CopyPasteManager;
import com.intellij.openapi.vfs.VirtualFile;

import java.awt.datatransfer.StringSelection;

public final class CopyLinesAction extends AnAction {
    @Override
    public void actionPerformed(AnActionEvent event) {
        Editor editor = event.getData(CommonDataKeys.EDITOR);
        VirtualFile virtualFile = event.getData(CommonDataKeys.VIRTUAL_FILE);
        if (editor == null || virtualFile == null) {
            return;
        }

        String textToCopy = buildCopyText(editor, virtualFile);
        CopyPasteManager.getInstance().setContents(new StringSelection(textToCopy));
    }

    @Override
    public void update(AnActionEvent event) {
        boolean enabled = event.getData(CommonDataKeys.EDITOR) != null
                && event.getData(CommonDataKeys.VIRTUAL_FILE) != null;
        event.getPresentation().setEnabledAndVisible(enabled);
    }

    static String buildCopyText(Editor editor, VirtualFile virtualFile) {
        Document document = editor.getDocument();
        SelectionModel selectionModel = editor.getSelectionModel();

        int startOffset;
        int endOffset;
        if (selectionModel.hasSelection()) {
            startOffset = selectionModel.getSelectionStart();
            endOffset = selectionModel.getSelectionEnd();
        } else {
            startOffset = editor.getCaretModel().getOffset();
            endOffset = startOffset;
        }

        int textLength = document.getTextLength();
        int startLine = document.getLineNumber(clamp(startOffset, 0, textLength)) + 1;
        int endLine = document.getLineNumber(clamp(endOffset, 0, textLength)) + 1;

        return CopyLineFormatter.format(virtualFile.getPath(), startLine, endLine);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(value, max));
    }
}
