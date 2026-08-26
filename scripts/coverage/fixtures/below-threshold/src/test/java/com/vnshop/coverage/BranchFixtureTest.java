package com.vnshop.coverage;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class BranchFixtureTest {
    @Test
    void classifiesPositiveValue() {
        assertEquals("positive", BranchFixture.classify(1));
    }

    @Test
    void classifiesNonPositiveValueWhenFullCoverageIsRequested() {
        if (Boolean.getBoolean("fixture.coverAll")) {
            assertEquals("non-positive", BranchFixture.classify(0));
        }
    }
}
