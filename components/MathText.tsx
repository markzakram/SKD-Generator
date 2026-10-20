import { mathHtml } from '@/lib/math';

export default function MathText({children}:{children:string}) {
  return <span className="math-text" dangerouslySetInnerHTML={{__html:mathHtml(children)}}/>;
}
