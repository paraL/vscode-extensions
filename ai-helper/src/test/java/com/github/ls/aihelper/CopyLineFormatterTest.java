package com.github.ls.aihelper;

public final class CopyLineFormatterTest {
    public static void main(String[] args) {
        assertEquals(
                "/Users/ls/project/Demo.java L12",
                CopyLineFormatter.format("/Users/ls/project/Demo.java", 12, 12));

        assertEquals(
                "/Users/ls/project/Demo.java L12~L20",
                CopyLineFormatter.format("/Users/ls/project/Demo.java", 12, 20));
    }

    private static void assertEquals(String expected, String actual) {
        if (!expected.equals(actual)) {
            throw new AssertionError("expected <" + expected + "> but was <" + actual + ">");
        }
    }
}
