package com.vnshop.coverage;

public final class BranchFixture {
    private BranchFixture() {
    }

    public static String classify(int value) {
        if (value > 0) {
            return "positive";
        }
        return "non-positive";
    }
}
