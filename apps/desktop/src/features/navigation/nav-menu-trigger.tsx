type Props = {
  onClick: () => void;
  ariaLabel?: string;
};

export function NavMenuTrigger(props: Props): JSX.Element {
  return (
    <button
      type="button"
      className="nav-menu-btn"
      aria-label={props.ariaLabel ?? '导航菜单'}
      onClick={props.onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" fill="currentColor" />
      </svg>
    </button>
  );
}

