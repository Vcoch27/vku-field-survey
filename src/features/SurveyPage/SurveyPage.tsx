import { SurveyForm, type SurveyFormProps } from '../SurveyForm/SurveyForm.tsx';
import { Link } from '../../app/router.tsx';

export function SurveyPage(props: SurveyFormProps) {
  return (
    <div className="page-container survey-page">
      <div className="survey-top-nav">
        <Link href="/" className="survey-back-link">
          &larr; Back to Workspace
        </Link>
      </div>

      <SurveyForm {...props} />
    </div>
  );
}
