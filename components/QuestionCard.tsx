import { LABELS } from '@/lib/config';
import { hasStimulus, optionSvg, questionSvg } from '@/lib/figures';
import type { Question } from '@/lib/types';
import Icon from './Icon';

// Tombol kecil di bawah gambar untuk menyalin gambar itu saja sebagai PNG (hanya tampil bila `onCopyImage` diberikan).
function CopyImage({ label, text, onCopy }: { label: string; text?: string; onCopy: () => void }) {
  return <button type="button" className={text ? 'copy-image labeled' : 'copy-image'} aria-label={label} title={label} onClick={onCopy}><Icon name="copy" size={14}/>{text}</button>;
}

export default function QuestionCard({ question: q, showAnswers, hideExplanation = false, choice, onChoose, onCopyImage }: { question: Question; showAnswers: boolean; hideExplanation?: boolean; choice?: number | null; onChoose?: (i: number) => void; onCopyImage?: (target: 'stimulus' | number) => void }) {
  return <article className="question-card">
    <div className="question-heading">
      <span className="question-number">{String(q.no).padStart(2, '0')}</span>
      <div className="question-meta"><span className={'tag tag-' + q.subtest.toLowerCase()}>{q.subtest}</span><span>{q.subtopic}</span></div>
      {!hideExplanation && <span className={'difficulty difficulty-' + q.difficulty}>{LABELS[q.difficulty]}{q.bloom ? ' · ' + q.bloom : ''}</span>}
    </div>
    <p className="question-stem">{q.stem}</p>
    {q.table && <div className="table-scroll"><table><thead><tr>{q.table.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>
      {q.table.rows.map((row, index) => <tr key={index}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}
    </tbody></table></div>}
    {hasStimulus(q) && q.visual && <><div className={'visual-stimulus visual-' + q.visual.kind} role="img" aria-label="Stimulus gambar figural"
      dangerouslySetInnerHTML={{ __html: questionSvg(q, false) }}/>{onCopyImage && <div className="image-tools"><CopyImage label="Salin gambar soal" text="Salin gambar" onCopy={() => onCopyImage('stimulus')}/></div>}</>}
    <ol className={q.visual ? 'options visual-options' : 'options'}>
      {q.options.map((option, index) => <li key={index} className={(showAnswers && index === q.answer ? 'correct-option ' : '') + (choice === index ? 'selected-option' : '')}>
        {onChoose ? <button className="option-choice" aria-pressed={choice === index} onClick={() => onChoose(index)}><span className="option-letter">{String.fromCharCode(65 + index)}</span>{optionSvg(option) ? <span role="img" aria-label={'Gambar opsi ' + String.fromCharCode(65 + index)} dangerouslySetInnerHTML={{ __html: optionSvg(option) }}/> : <span>{option.text}</span>}</button> : <>
        <span className="option-letter">{String.fromCharCode(65 + index)}</span>
        {optionSvg(option) ? <div role="img" aria-label={'Gambar opsi ' + String.fromCharCode(65 + index)}
          dangerouslySetInnerHTML={{ __html: optionSvg(option) }}/> : <span>{option.text}</span>}
        {showAnswers && q.subtest === 'TKP' && <span className="option-score">{option.score} poin</span>}
        {onCopyImage && optionSvg(option) && <CopyImage label={'Salin gambar opsi ' + String.fromCharCode(65 + index)} onCopy={() => onCopyImage(index)}/>}
        </>}
      </li>)}
    </ol>
    {!hideExplanation && <details className="explanation" open={showAnswers}>
      <summary><Icon name="book" size={15}/><span>Kunci & pembahasan</span><Icon name="chevron" size={14}/></summary>
      <div className="explanation-body">
        <p className="answer-label">Jawaban {String.fromCharCode(65 + q.answer)}{q.subtest === 'TKP' ? ' · 5 poin' : ''}</p>
        <p className="explanation-text">{q.explanation}</p>
        <div className="option-reasons">{q.options.map((option, index) => <div key={index}>
          <span>{String.fromCharCode(65 + index)}{q.subtest === 'TKP' ? ' · ' + option.score : ''}</span><p>{option.reason}</p>
        </div>)}</div>
        <p className="source-note">{q.source}</p>
      </div>
    </details>}
  </article>;
}
