(() => { //Unit tests
    function assertEqual(actual, expected) {
        if (actual !== expected) {
            return { onFail: (f) => { f(); throw "Test case failed."; } };
        } else {
            return { onFail: (f) => { /*Does nothing*/} };
        }
    }
    function guessContradictsSomeEvidenceTestCase(guess, evidence, expected) {
        let result = guessContradictsSomeEvidence(guess, evidence);
        assertEqual(result, expected).onFail(() => {
            console.log("Expected guess", guess, "with evidence", evidence, "to result in", expected);
            // debugger;
            guessContradictsSomeEvidence(guess, evidence);
        });
    }
    (() => {
        /*
         * https://github.com/NebuPookins/JS-Mastermind-Solver/issues/3
         * With 8+ colors, 4 pegs, and no duplicates, if the first 4 colors
         * don't appear in the solution, then the next guess should only
         * contain colors that were not yet guessed.
         */
        let numPegs = 4;
        let colors = [1, 2, 3, 4, 5, 6, 7, 8];
        let evidence = [
            { guess: [1, 2, 3, 4], bothCorrect: 0, colorCorrect: 0 }
        ];
        for (let i = 0; i < 100; i++) {
            let gameState = {
                numPegs: numPegs,
                colors: colors,
                allowDups: false,
                possibleGuesses: generateAllPossibleGuessesNoDups(numPegs, colors)
            };
            let result = generateNextGuess(gameState, evidence);
            assertEqual(
                result.includes(1) || result.includes(2) || result.includes(3) || result.includes(4),
                false
            ).onFail(() => {
                console.log("Expected result to not include", evidence[0].guess, "but was", result);
            });
        }
    })();

    //generic tests
    guessContradictsSomeEvidenceTestCase(["R", "G", "B", "Y"], [{guess: ["B", "G", "C", "C"], bothCorrect: 1, colorCorrect: 1}], false);
    guessContradictsSomeEvidenceTestCase(["R", "B", "Y", "R"], [{guess: ["G", "B", "R", "Y"], bothCorrect: 1, colorCorrect: 3}], true);
    guessContradictsSomeEvidenceTestCase(["R", "G", "B", "Y"], [
        {guess: ["R", "R", "R", "B"], bothCorrect: 1, colorCorrect: 1},
        {guess: ["Y", "R", "B", "G"], bothCorrect: 1, colorCorrect: 3},
    ], false);
    console.log("All tests pass")
});