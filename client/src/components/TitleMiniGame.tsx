import { useMemo, useState } from 'react';

type Question = { prompt: string; answer: string; options: string[] };
type Props = {
    title: string;
    year: number | null;
    genres: string[];
    episodeCount: number | null;
    format: string;
};

const GENRE_POOL = ['Драма', 'Комедия', 'Фантастика', 'Боевик', 'Приключения', 'Романтика', 'Триллер', 'Фэнтези'];

function makeQuestions({ year, genres, episodeCount, format }: Props): Question[] {
    const questions: Question[] = [];
    if (year && year > 1800) {
        const years = [year - 2, year - 1, year + 1, year + 2];
        questions.push({ prompt: 'В каком году вышел тайтл?', answer: String(year), options: [String(year), ...years.slice(0, 3).map(String)] });
    }
    if (genres.length) {
        const answer = genres[0];
        const distractors = GENRE_POOL.filter((genre) => !genres.includes(genre) && genre !== answer).slice(0, 3);
        questions.push({ prompt: 'Какой жанр есть в этом тайтле?', answer, options: [answer, ...distractors] });
    }
    if (episodeCount && episodeCount > 0) {
        const options = [episodeCount, Math.max(1, episodeCount - 2), episodeCount + 2, episodeCount + 5]
            .map(String).filter((value, index, all) => all.indexOf(value) === index);
        questions.push({ prompt: 'Сколько всего серий?', answer: String(episodeCount), options });
    }
    if (questions.length < 2) {
        const answer = format || 'Полнометражный фильм';
        const options = [answer, 'Сериал', 'Фильм', 'OVA'].filter((value, index, all) => all.indexOf(value) === index);
        questions.push({ prompt: 'Какой это формат?', answer, options });
    }
    return questions.map((question) => ({
        ...question,
        options: [...question.options].sort((a, b) => a.localeCompare(b, 'ru')),
    }));
}

export function TitleMiniGame(props: Props) {
    const questions = useMemo(() => makeQuestions(props), [props.title, props.year, props.genres.join('|'), props.episodeCount, props.format]);
    const [step, setStep] = useState(0);
    const [score, setScore] = useState(0);
    const [choice, setChoice] = useState<string | null>(null);
    const done = step >= questions.length;

    function answer(value: string) {
        if (choice !== null) return;
        setChoice(value);
        if (value === questions[step].answer) setScore((current) => current + 1);
    }

    function next() {
        setChoice(null);
        setStep((current) => current + 1);
    }

    function restart() {
        setStep(0);
        setScore(0);
        setChoice(null);
    }

    return (
        <section className="title-game card" aria-live="polite">
            <div className="title-game__eyebrow">Проверка памяти</div>
            <h3>{props.title}</h3>
            {done ? (
                <div className="title-game__result">
                    <p>Результат: <strong>{score} из {questions.length}</strong></p>
                    <button className="btn-accent" onClick={restart}>Сыграть ещё раз</button>
                </div>
            ) : (
                <>
                    <div className="title-game__progress">Вопрос {step + 1} из {questions.length}</div>
                    <h4>{questions[step].prompt}</h4>
                    <div className="title-game__options">
                        {questions[step].options.map((option) => {
                            const selected = choice === option;
                            const correct = choice !== null && option === questions[step].answer;
                            return (
                                <button
                                    key={option}
                                    className={'title-game__option' + (correct ? ' title-game__option--correct' : selected ? ' title-game__option--wrong' : '')}
                                    onClick={() => answer(option)}
                                    disabled={choice !== null}
                                >
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                    {choice !== null && (
                        <div className="title-game__feedback">
                            <span>{choice === questions[step].answer ? 'Верно!' : `Правильный ответ: ${questions[step].answer}`}</span>
                            <button className="btn-accent" onClick={next}>{step + 1 === questions.length ? 'Результат' : 'Дальше'}</button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
