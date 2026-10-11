import { S } from './strings';
import { useDialog } from './use-dialog';
import { CloseIcon } from './Icons';

export interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const ref = useDialog(open, onClose);
  return (
    <dialog ref={ref} className="dlg" aria-labelledby="help-title">
      <div className="dlg__head">
        <h2 id="help-title" className="dlg__title">
          {S.help.title}
        </h2>
        <button type="button" className="ui-btn ui-btn--icon" aria-label={S.help.close} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="dlg__body">
        <table className="keys">
          <thead>
            <tr>
              <th scope="col">{S.help.keysHeading}</th>
              <th scope="col">{S.help.actionHeading}</th>
            </tr>
          </thead>
          <tbody>
            {S.help.keys.map(([key, action]) => (
              <tr key={key}>
                <td>
                  <kbd>{key}</kbd>
                </td>
                <td>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ui-note">{S.help.note}</p>
      </div>
      <div className="dlg__foot">
        <button type="button" className="ui-btn" onClick={onClose}>
          {S.help.close}
        </button>
      </div>
    </dialog>
  );
}
