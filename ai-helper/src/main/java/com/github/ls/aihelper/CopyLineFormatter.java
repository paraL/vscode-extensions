package com.github.ls.aihelper;

public final class CopyLineFormatter {
    private CopyLineFormatter() {
    }

    public static String format(String absolutePath, int startLine, int endLine) {
        if (absolutePath == null || absolutePath.isBlank()) {
            throw new IllegalArgumentException("absolutePath must not be blank");
        }
        if (startLine < 1 || endLine < 1) {
            throw new IllegalArgumentException("line numbers are 1-based");
        }
        if (endLine < startLine) {
            throw new IllegalArgumentException("endLine must be greater than or equal to startLine");
        }

        if (startLine == endLine) {
            return absolutePath + " L" + startLine;
        }
        return absolutePath + " L" + startLine + "~L" + endLine;
    }
}
