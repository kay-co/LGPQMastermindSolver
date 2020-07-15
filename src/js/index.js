'use strict';
var $startBtn = $('#start');
var $oldGuessesTable = $('#old-guesses-table');
var $playAreaOldGuesses = $('#old-guesses');
var $playAreaCurGuess = $('#cur-guess');
var $colorLabels = $('#colorLabels');
var $numPegs = $('#numPegs');
var $allowDups = $('#allowDups');
var $inputAlert = $('#input-alert');
var $curGuessAlert = $('#cur-guess-alert');
var $success = $('#success');
var newGuessTemplate = Handlebars.compile($('#new-guess-template').html());
var oldGuessTemplate = Handlebars.compile($('#old-guess-template').html());

/*
 * Structure is like:
 * { numPegs: 4, colors: ["red", "green",."blue"], allowDups: true}
 */
var globalGameState = null;

function pickFromArray(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * @param colors e.g. ["red", "green", "blue"];
 * @return e.g. [[rrr], [rrg], [rrb], [rgr], ... ]
 */
function generateAllPossibleGuessesWithDups(numPegs, colors) {
    if (numPegs < 1) {
        throw "numPegs must be at least 1.";
    }
    if (numPegs === 1) {
        return colors.slice(0);
    }
    let suffixes = generateAllPossibleGuessesWithDups(numPegs - 1, colors);
    let retVal = [];
    colors.forEach((color) => {
        suffixes.forEach((suffix) => {
            retVal.push([color].concat(suffix));
        });
    });
    return retVal;
}

function generateAllPossibleGuessesNoDups(numPegs, colors) {
    if (numPegs < 1) {
        throw "numPegs must be at least 1.";
    }
    if (numPegs === 1) {
        return colors.slice(0);
    }
    let retVal = [];
    for (let index = 0; index < colors.length; index++) {
        let firstColor = colors[index];
        let remainingColors = colors.filter((element, otherIndex) => otherIndex !== index);
        let suffixes = generateAllPossibleGuessesNoDups(numPegs - 1, remainingColors);
        suffixes.forEach((suffix) => {
            retVal.push([firstColor].concat(suffix));
        });
    }
    return retVal;
}

/**
 * @param answer e.g. ["red", "green", "blue", "blue"]
 * @param guess e.g. ["blue, green", "yellow", "red"]
 * return e.g. { bothCorrect: 1, colorCorrect: 2 }
 */
function judgeGuess(answer, guess) {
    let retVal = {bothCorrect: 0, colorCorrect: 0};
    let unaccountedForAnswers = [];
    let unaccountedForGuesses = [];
    for (let i = 0; i < answer.length; ++i) {
        if (answer[i] === guess[i]) {
            retVal.bothCorrect++;
        } else {
            unaccountedForAnswers.push(answer[i]);
            unaccountedForGuesses.push(guess[i]);
        }
    }
    unaccountedForAnswers.forEach((a) => {
        var guessIndex = unaccountedForGuesses.indexOf(a);
        if (guessIndex !== -1) {
            retVal.colorCorrect++;
            unaccountedForGuesses.splice(guessIndex, 1);
        }
    });
    return retVal;
}

/**
 * @param guess e.g. ["red", "green", "blue"]
 * @param evidences e.g. [{guess: ["red", "red", "red"], bothCorrect: 0, colorCorrect: 0}]
 * @return e.g. false
 */
function guessContradictsSomeEvidence(guess, evidences) {
    for (let key in evidences) {
        let evidence = evidences[key];
        /*
         * Treat the guess like an answer and the evidence as a guess, and
         * see whether the judgment is the same.
         */
        let judgement = judgeGuess(guess, evidence.guess);
        if ((judgement.bothCorrect !== evidence.bothCorrect) || (judgement.colorCorrect !== evidence.colorCorrect)) {
            //console.log("guess", guess, "contradicts evidence", evidence.guess);
            return true;
        }
    }
    return false;
}

/**
 * Removes and returns the element at the provided index from an array.
 * This function may shuffle/reorder the elements of the array for
 * efficiency reasons. For example, if you request to remove the first
 * element of the array, rather than reindexing every element in the
 * array (O(N)), this function may choose to swap the first and last
 * element of the array, and then remove the last element from the
 * array (O(1)).
 */
function quickRemoveFromArray(index, array) {
    var arrayLength = array.length;
    if (index >= arrayLength || index < 0) {
        throw "Tried to access index " + index + " from array of length " + arrayLength;
    }
    if (arrayLength === 1) {
        return array.pop();
    }
    var retVal = array[index];
    array[index] = array.pop();
    return retVal;
}

/**
 * Returns an array e.g. ["red", "green", "blue"] or null to indicate
 * that there are no possible guesses left. It randomly selects one of
 * the guesses from the provided `gameState` parameter, and removes
 * that guess from the list of possible guesses. This function may also
 * "shuffle" or reorder the elements in the possible guesses list for
 * efficiency reasons.
 */
function generateNextGuess(gameState, evidence) {
    let guessIndex;
    if (gameState.firstGuess === true) {
        // Start first guess with (Scroll Scroll Medal Medal) since party members will still be collecting food / wine
        guessIndex = Math.min(5, gameState.possibleGuesses.length - 1);
        gameState.firstGuess = false;
    } else {
        guessIndex = Math.floor(Math.random() * gameState.possibleGuesses.length);
    }
    let guess = quickRemoveFromArray(guessIndex, gameState.possibleGuesses);
    while (guessContradictsSomeEvidence(guess, evidence)) {
        if (gameState.possibleGuesses.length < 1) {
            return null;
        }
        guessIndex = Math.floor(Math.random() * gameState.possibleGuesses.length);
        guess = quickRemoveFromArray(guessIndex, gameState.possibleGuesses);
    }
    if (typeof guess !== 'object') {
        debugger;
        throw "Expected guess to be an array, but it was " + (typeof guess);
    }
    return guess;
}

function guessToString(guess) {
    if ((typeof guess) !== "object") {
        throw "Expected guess to be an array but it was a " + (typeof guess);
    }
    return guess.join(", ");
}

function updateUiWithAGuess() {
    $curGuessAlert.hide();
    $success.hide();
    if ($playAreaCurGuess.find('input').length !== 0) {
        let bothCorrect = parseInt($playAreaCurGuess.find('.bothCorrect').val());
        let colorCorrect = parseInt($playAreaCurGuess.find('.colorCorrect').val());
        let unknown = parseInt($playAreaCurGuess.find('.unknown').val());
        if (bothCorrect + colorCorrect + unknown > globalGameState.numPegs) {
            $curGuessAlert.text(`The sum of Correct, Incorrect and Unknown should be less than ${globalGameState.numPegs}.`);
            $curGuessAlert.show();
            return;
        }
        if (bothCorrect === globalGameState.numPegs) {
            $curGuessAlert.hide();
            $success.show();
            return;
        }
        $oldGuessesTable.show();
        let guess = $playAreaCurGuess.find('.guess').data('guess');
        let $guessToAdd = $(oldGuessTemplate({
            guess: guessToString(guess),
            bothCorrect: bothCorrect,
            colorCorrect: colorCorrect,
            unknown: unknown
        }));
        $guessToAdd.data('evidence', {
            guess: guess,
            bothCorrect: bothCorrect,
            colorCorrect: colorCorrect,
            unknown: unknown
        });
        $playAreaOldGuesses.append($guessToAdd);
    }
    var evidence = [];
    $playAreaOldGuesses.find('.evidence').each((index, evidenceRow) => {
        let $evidenceRow = $(evidenceRow);
        evidence.push($evidenceRow.data('evidence'));
    });
    var guess = generateNextGuess(globalGameState, evidence);
    if (guess == null) {
        $playAreaCurGuess.hide();
        $curGuessAlert.html("Ran out of possible guesses. There might be a contradiction in the information you entered above. Click 'Restart' to try a new game.");
        $curGuessAlert.show();
    } else {
        $playAreaCurGuess.html(newGuessTemplate({
            guess: guessToString(guess),
            numPegs: globalGameState.numPegs
        }));
        $playAreaCurGuess.find('.guess').data('guess', guess);
        $playAreaCurGuess.show();
    }
}

$startBtn.on('click', () => {
    $playAreaOldGuesses.html('');
    $playAreaCurGuess.html('');
    $inputAlert.hide();
    $curGuessAlert.hide();
    $success.hide();
    var numPegs = parseInt($numPegs.val(), 10);
    if (numPegs < 1) {
        $inputAlert.text("Need at least one peg.");
        $inputAlert.show();
        return
    }
    var parsedColors = $colorLabels.val()
        .split(/[ ,]+/)
        .map((color) => color.trim())
        .filter((color) => color !== "");
    if (parsedColors.length < 1) {
        $inputAlert.text("Need at least one color.");
        $inputAlert.show();
        return
    }
    var allowDups = $allowDups.is(':checked');
    if (!allowDups) {
        if (parsedColors.length < numPegs) {
            $inputAlert.text("If duplicates are not allowed, need at least as many colors as there are pegs.");
            $inputAlert.show();
            return
        }
    }
    let possibleGuesses = allowDups ? generateAllPossibleGuessesWithDups(numPegs, parsedColors) :
        generateAllPossibleGuessesNoDups(numPegs, parsedColors);

    globalGameState = {
        numPegs: numPegs,
        colors: parsedColors,
        allowDups: allowDups,
        possibleGuesses: possibleGuesses,
        firstGuess: true
    };
    console.log(globalGameState);
    $startBtn.text("Restart");
    updateUiWithAGuess();
});
$playAreaCurGuess.on('click', 'button', updateUiWithAGuess);