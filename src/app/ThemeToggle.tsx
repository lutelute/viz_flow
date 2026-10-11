import { S } from './strings';

export interface ThemeToggleProps {
  dark: boolean;
  onToggle: () => void;
}

export function ThemeToggle({ dark, onToggle }: ThemeToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={dark} className="ui-btn" onClick={onToggle} title={dark ? S.theme.toLight : S.theme.toDark}>
      {S.theme.dark}
    </button>
  );
}
