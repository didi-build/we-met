/* @ds-bundle: {"format":4,"namespace":"DidiBuildDesignSystem_b51779","components":[{"name":"ExampleCard","sourcePath":"components/content/ExampleCard.jsx"},{"name":"Eyebrow","sourcePath":"components/content/Eyebrow.jsx"},{"name":"Heading","sourcePath":"components/content/Heading.jsx"},{"name":"SoftPanel","sourcePath":"components/content/SoftPanel.jsx"},{"name":"Step","sourcePath":"components/content/Step.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"LeafMark","sourcePath":"components/core/LeafMark.jsx"},{"name":"Logo","sourcePath":"components/core/Logo.jsx"},{"name":"ThemeToggle","sourcePath":"components/core/ThemeToggle.jsx"},{"name":"Accordion","sourcePath":"components/disclosure/Accordion.jsx"},{"name":"Alert","sourcePath":"components/forms/Alert.jsx"},{"name":"TextField","sourcePath":"components/forms/TextField.jsx"},{"name":"Vine","sourcePath":"components/illustration/Vine.jsx"},{"name":"SiteFooter","sourcePath":"components/navigation/SiteFooter.jsx"},{"name":"SiteHeader","sourcePath":"components/navigation/SiteHeader.jsx"}],"sourceHashes":{"components/content/ExampleCard.jsx":"4a1e1a639766","components/content/Eyebrow.jsx":"64457086ca54","components/content/Heading.jsx":"ce1ce7c016ec","components/content/SoftPanel.jsx":"25574d47dff6","components/content/Step.jsx":"09ba6c736662","components/core/Badge.jsx":"3317e4a6da6b","components/core/Button.jsx":"a73d931e27e5","components/core/Chip.jsx":"30ab839024d6","components/core/IconButton.jsx":"77d5f7af3336","components/core/LeafMark.jsx":"d0252524fbea","components/core/Logo.jsx":"d24664d7aa3d","components/core/ThemeToggle.jsx":"a1de007e5ae2","components/disclosure/Accordion.jsx":"4ebc2841fea9","components/forms/Alert.jsx":"04361da3fc94","components/forms/TextField.jsx":"1028ea0113b0","components/illustration/Vine.jsx":"a217f8799147","components/navigation/SiteFooter.jsx":"69df8c711896","components/navigation/SiteHeader.jsx":"1c9b4dfdb5d5","ui_kits/website/sections.jsx":"b6be46d56f7d"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DidiBuildDesignSystem_b51779 = window.DidiBuildDesignSystem_b51779 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/content/Heading.jsx
try { (() => {
const L = {
  display: {
    tag: 'h1',
    fs: 'var(--type-display-size)',
    lh: 'var(--type-display-lh)',
    ls: 'var(--type-display-tracking)'
  },
  feature: {
    tag: 'h2',
    fs: 'var(--type-feature-size)',
    lh: 'var(--type-feature-lh)',
    ls: 'var(--type-feature-tracking)',
    mw: '20ch'
  },
  section: {
    tag: 'h2',
    fs: 'var(--type-section-size)',
    lh: 'var(--type-section-lh)',
    ls: 'var(--type-section-tracking)',
    mw: '18ch'
  },
  card: {
    tag: 'h3',
    fs: 'var(--type-card-title-size)',
    lh: 'var(--type-card-title-lh)',
    ls: '-0.01em'
  }
};
function Heading({
  level = 'section',
  as,
  sub,
  id,
  children,
  style
}) {
  const c = L[level] || L.section;
  const Tag = as || c.tag;
  return /*#__PURE__*/React.createElement(Tag, {
    id: id,
    style: {
      margin: 0,
      maxWidth: c.mw,
      fontWeight: 600,
      fontSize: c.fs,
      lineHeight: c.lh,
      letterSpacing: c.ls,
      textWrap: 'balance',
      ...style
    }
  }, children, sub ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: '.35em',
      fontSize: 'var(--type-display-sub-scale)',
      lineHeight: 'var(--type-display-sub-lh)',
      letterSpacing: '-0.02em',
      color: 'var(--accent-text)'
    }
  }, sub) : null);
}
Object.assign(__ds_scope, { Heading });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/Heading.jsx", error: String((e && e.message) || e) }); }

// components/content/SoftPanel.jsx
try { (() => {
function SoftPanel({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      background: 'var(--accent-soft)',
      borderRadius: 'var(--radius-card)',
      padding: 'var(--panel-pad)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { SoftPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/SoftPanel.jsx", error: String((e && e.message) || e) }); }

// components/content/Step.jsx
try { (() => {
function Step({
  n,
  title,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      borderTop: '2px solid var(--ink)',
      paddingTop: 24,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      fontSize: 'var(--type-numeral-size)',
      lineHeight: 1,
      fontWeight: 600,
      color: 'var(--accent-text)',
      letterSpacing: 'var(--type-numeral-tracking)'
    }
  }, n), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '8px 0 0',
      fontSize: 'var(--type-card-title-size)',
      lineHeight: 'var(--type-card-title-lh)',
      fontWeight: 600
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--size-body-sm)',
      color: 'var(--ink-muted)',
      textWrap: 'pretty'
    }
  }, children));
}
Object.assign(__ds_scope, { Step });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/Step.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function Badge({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      alignSelf: 'flex-start',
      display: 'inline-block',
      fontSize: 'var(--size-badge)',
      fontWeight: 600,
      padding: '4px 10px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--surface-2)',
      color: 'var(--ink-muted)',
      lineHeight: 1.6,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/content/ExampleCard.jsx
try { (() => {
function ExampleCard({
  n,
  label,
  title,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-card)',
      padding: 28,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minHeight: 240,
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, null, label || 'Example ' + n), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '8px 0 0',
      fontSize: 'var(--type-card-title-size)',
      lineHeight: 'var(--type-card-title-lh)',
      fontWeight: 600,
      letterSpacing: '-0.01em'
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--size-body-sm)',
      lineHeight: 1.6,
      color: 'var(--ink-muted)',
      textWrap: 'pretty'
    }
  }, children));
}
Object.assign(__ds_scope, { ExampleCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/ExampleCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  lg: {
    h: 56,
    pad: '0 28px',
    fs: 17,
    gap: 12
  },
  md: {
    h: 48,
    pad: '0 22px',
    fs: 16,
    gap: 10
  },
  sm: {
    h: 44,
    pad: '0 18px',
    fs: 15,
    gap: 10
  }
};
function Button({
  variant = 'primary',
  size = 'lg',
  href,
  icon,
  children,
  style,
  disabled,
  type,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const z = SIZES[size] || SIZES.lg;
  const Tag = href ? 'a' : 'button';
  let s;
  if (variant === 'link') {
    s = {
      font: '600 16px var(--font-sans)',
      color: 'var(--ink)',
      textDecoration: 'underline',
      textUnderlineOffset: 3,
      textDecorationThickness: 1.5,
      background: 'none',
      border: 0,
      padding: 0,
      cursor: 'pointer'
    };
  } else {
    s = {
      minHeight: z.h,
      display: 'inline-flex',
      alignItems: 'center',
      gap: z.gap,
      padding: z.pad,
      borderRadius: 'var(--radius-pill)',
      font: '600 ' + z.fs + 'px var(--font-sans)',
      textDecoration: 'none',
      whiteSpace: 'nowrap',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.7 : 1,
      transition: 'background var(--dur-fast), color var(--dur-fast)'
    };
    if (variant === 'primary') Object.assign(s, {
      border: 0,
      background: h && !disabled ? 'var(--accent-hover)' : 'var(--accent)',
      color: 'var(--accent-ink)'
    });else Object.assign(s, {
      border: '1.5px solid var(--ink)',
      background: h && !disabled ? 'var(--ink)' : 'transparent',
      color: h && !disabled ? 'var(--bg)' : 'var(--ink)'
    });
  }
  return /*#__PURE__*/React.createElement(Tag, _extends({
    href: href,
    type: href ? undefined : type || 'button',
    disabled: href ? undefined : disabled,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      ...s,
      ...style
    }
  }, rest), children, icon === 'arrow' ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\u2192") : icon);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
function Chip({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      padding: '6px 14px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--accent-soft)',
      color: 'var(--ink)',
      fontSize: 'var(--size-label)',
      fontWeight: 500,
      lineHeight: 1.6,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  variant = 'outline',
  label,
  href,
  children,
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const Tag = href ? 'a' : 'button';
  const s = {
    width: 44,
    height: 44,
    display: 'grid',
    placeItems: 'center',
    padding: 0,
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
    transition: 'background var(--dur-fast), color var(--dur-fast)',
    border: variant === 'outline' ? '1px solid var(--line)' : 0,
    background: h ? 'var(--surface-2)' : 'transparent',
    color: variant === 'ghost' && !h ? 'var(--ink-muted)' : 'var(--ink)',
    ...style
  };
  return /*#__PURE__*/React.createElement(Tag, _extends({
    href: href,
    type: href ? undefined : 'button',
    "aria-label": label,
    title: label,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: s
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/LeafMark.jsx
try { (() => {
function LeafMark({
  size = 14,
  color = 'var(--accent)',
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'inline-block',
      flex: 'none',
      width: size,
      height: size,
      borderRadius: size + 'px 2px ' + size + 'px 2px',
      background: color,
      ...style
    }
  });
}
Object.assign(__ds_scope, { LeafMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/LeafMark.jsx", error: String((e && e.message) || e) }); }

// components/content/Eyebrow.jsx
try { (() => {
function Eyebrow({
  mark,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 'var(--size-label)',
      fontWeight: 600,
      color: 'var(--accent-text)',
      ...style
    }
  }, mark ? /*#__PURE__*/React.createElement(__ds_scope.LeafMark, {
    size: 12
  }) : null, children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/Logo.jsx
try { (() => {
function Logo({
  size = 'lg',
  href,
  style
}) {
  const lg = size === 'lg';
  const inner = [/*#__PURE__*/React.createElement(__ds_scope.LeafMark, {
    key: "m",
    size: lg ? 14 : 12
  }), /*#__PURE__*/React.createElement("span", {
    key: "t",
    style: {
      fontWeight: 700,
      fontSize: lg ? 'var(--size-wordmark)' : 'var(--size-body)',
      letterSpacing: lg ? '-0.01em' : 0
    }
  }, "Didi Build")];
  const s = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
    color: 'var(--ink)',
    borderRadius: 'var(--radius-sm)',
    ...style
  };
  return href ? /*#__PURE__*/React.createElement("a", {
    href: href,
    style: s
  }, inner) : /*#__PURE__*/React.createElement("span", {
    style: s
  }, inner);
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Logo.jsx", error: String((e && e.message) || e) }); }

// components/core/ThemeToggle.jsx
try { (() => {
function ThemeToggle({
  theme = 'light',
  onToggle
}) {
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    label: label,
    onClick: onToggle
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 16,
      height: 16,
      borderRadius: 999,
      border: '2px solid currentColor',
      background: 'linear-gradient(90deg,currentColor 50%,transparent 50%)'
    }
  }));
}
Object.assign(__ds_scope, { ThemeToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ThemeToggle.jsx", error: String((e && e.message) || e) }); }

// components/disclosure/Accordion.jsx
try { (() => {
function PlusMinus({
  open,
  filled,
  box
}) {
  const bar = {
    position: 'absolute',
    borderRadius: 2,
    background: 'currentColor'
  };
  if (!box) return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'relative',
      width: 12,
      height: 12,
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...bar,
      left: 0,
      top: 5,
      width: 12,
      height: 2
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      ...bar,
      left: 5,
      top: 0,
      width: 2,
      height: 12,
      transition: 'transform var(--dur-icon)',
      transform: 'scaleY(' + (open ? 0 : 1) + ')'
    }
  }));
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      flex: 'none',
      position: 'relative',
      width: 36,
      height: 36,
      borderRadius: 999,
      border: '1px solid ' + (filled ? 'var(--accent)' : 'var(--line-strong)'),
      background: filled ? 'var(--accent)' : 'transparent',
      color: filled ? 'var(--accent-ink)' : 'var(--ink)',
      transition: 'background var(--dur-base), border-color var(--dur-base), color var(--dur-base)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...bar,
      left: 11,
      top: 16,
      width: 12,
      height: 2
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      ...bar,
      left: 16,
      top: 11,
      width: 2,
      height: 12,
      transition: 'transform var(--dur-icon)',
      transform: 'scaleY(' + (open ? 0 : 1) + ')'
    }
  }));
}
function Row({
  item,
  open,
  onToggle,
  uid,
  i
}) {
  const [h, setH] = React.useState(false);
  const b = uid + '-b' + i,
    p = uid + '-p' + i;
  return /*#__PURE__*/React.createElement("li", {
    style: {
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    id: b,
    "aria-expanded": open,
    "aria-controls": p,
    onClick: onToggle,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      width: '100%',
      minHeight: 72,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 24,
      padding: '18px 0',
      background: 'transparent',
      border: 0,
      color: h ? 'var(--accent-text)' : 'var(--ink)',
      font: '600 var(--type-question-size)/var(--type-question-lh) var(--font-sans)',
      letterSpacing: '-0.005em',
      textAlign: 'left',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      textWrap: 'pretty'
    }
  }, item.q), /*#__PURE__*/React.createElement(PlusMinus, {
    box: true,
    open: open,
    filled: open
  }))), /*#__PURE__*/React.createElement("div", {
    id: p,
    role: "region",
    "aria-labelledby": b,
    style: {
      display: 'grid',
      gridTemplateRows: open ? '1fr' : '0fr',
      visibility: open ? 'visible' : 'hidden',
      transition: 'grid-template-rows var(--dur-disclose) ease, visibility var(--dur-disclose)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'hidden',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      padding: '0 clamp(0px,6cqi,60px) 28px 0',
      maxWidth: 'var(--measure-answer)',
      color: 'var(--ink-muted)',
      textWrap: 'pretty'
    }
  }, item.a))));
}
function Accordion({
  items = [],
  defaultOpen = [],
  showToggleAll = true,
  countLabel,
  style
}) {
  const [open, setOpen] = React.useState(() => new Set(defaultOpen));
  const [h, setH] = React.useState(false);
  const uid = 'acc' + (React.useId ? React.useId().replace(/:/g, '') : '');
  const all = items.length > 0 && items.every((_, i) => open.has(i));
  const toggle = i => setOpen(s => {
    const n = new Set(s);
    if (n.has(i)) n.delete(i);else n.add(i);
    return n;
  });
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, showToggleAll ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      paddingBottom: 20,
      borderBottom: '2px solid var(--ink)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--size-label)',
      fontWeight: 600,
      color: 'var(--ink-muted)',
      whiteSpace: 'nowrap'
    }
  }, countLabel || items.length + ' questions'), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-expanded": all,
    onClick: () => setOpen(all ? new Set() : new Set(items.map((_, i) => i))),
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      minHeight: 44,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      padding: '0 18px',
      borderRadius: 999,
      border: '1.5px solid var(--ink)',
      background: h ? 'var(--ink)' : 'transparent',
      color: h ? 'var(--bg)' : 'var(--ink)',
      font: '600 15px var(--font-sans)',
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(PlusMinus, {
    open: all
  }), all ? 'Collapse all' : 'Expand all')) : null, /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      padding: 0,
      listStyle: 'none'
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement(Row, {
    key: i,
    item: it,
    i: i,
    uid: uid,
    open: open.has(i),
    onToggle: () => toggle(i)
  }))));
}
Object.assign(__ds_scope, { Accordion });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/disclosure/Accordion.jsx", error: String((e && e.message) || e) }); }

// components/forms/Alert.jsx
try { (() => {
function Alert({
  variant = 'error',
  title,
  children,
  action,
  id,
  style
}) {
  if (variant === 'success') return /*#__PURE__*/React.createElement("div", {
    role: "status",
    tabIndex: -1,
    id: id,
    style: {
      background: 'var(--accent-soft)',
      borderRadius: 'var(--radius-card)',
      padding: 'clamp(28px,5cqi,48px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      alignItems: 'flex-start',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 48,
      height: 48,
      borderRadius: 999,
      background: 'var(--accent)',
      color: 'var(--accent-ink)',
      display: 'grid',
      placeItems: 'center',
      fontSize: 22,
      fontWeight: 700
    }
  }, "\u2713"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--type-statement-size)',
      lineHeight: 'var(--type-statement-lh)',
      fontWeight: 600,
      letterSpacing: '-0.015em'
    }
  }, title), children, action ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, action) : null);
  return /*#__PURE__*/React.createElement("div", {
    role: "alert",
    tabIndex: -1,
    id: id,
    style: {
      background: 'var(--error-soft)',
      border: '1px solid var(--error)',
      borderRadius: 'var(--radius-alert)',
      padding: '16px 18px',
      display: 'flex',
      gap: 12,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      flex: 'none',
      width: 24,
      height: 24,
      borderRadius: 999,
      background: 'var(--error)',
      color: 'var(--bg)',
      display: 'grid',
      placeItems: 'center',
      fontWeight: 700,
      fontSize: 15
    }
  }, "!"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontWeight: 600
    }
  }, title), children ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 0',
      fontSize: 'var(--size-body-sm)',
      color: 'var(--ink)'
    }
  }, children) : null));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Alert.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function TextField({
  label,
  optional,
  error,
  multiline,
  id,
  rows = 5,
  style,
  onFocus,
  onBlur,
  ...rest
}) {
  const auto = React.useId ? React.useId().replace(/:/g, '') : 'f';
  const fid = id || 'tf' + auto;
  const [f, setF] = React.useState(false);
  const errId = error ? fid + '-err' : undefined;
  const Tag = multiline ? 'textarea' : 'input';
  const s = {
    width: '100%',
    borderRadius: 'var(--radius-field)',
    border: '1px solid ' + (f ? 'var(--accent)' : error ? 'var(--error)' : 'var(--line-strong)'),
    boxShadow: f ? '0 0 0 2px var(--accent)' : 'none',
    outline: 'none',
    background: 'var(--surface)',
    color: 'var(--ink)',
    transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)'
  };
  Object.assign(s, multiline ? {
    minHeight: 144,
    padding: '14px 16px',
    resize: 'vertical',
    font: '400 17px/1.55 var(--font-sans)'
  } : {
    minHeight: 52,
    padding: '0 16px',
    font: '400 17px var(--font-sans)'
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: fid,
    style: {
      fontWeight: 500,
      fontSize: 'var(--size-label)',
      display: 'flex',
      gap: 6,
      alignItems: 'baseline'
    }
  }, label, optional ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 400,
      fontSize: 'var(--size-caption)',
      color: 'var(--ink-muted)'
    }
  }, "(optional)") : null), /*#__PURE__*/React.createElement(Tag, _extends({
    id: fid,
    rows: multiline ? rows : undefined,
    "aria-invalid": !!error,
    "aria-describedby": errId,
    onFocus: e => {
      setF(true);
      onFocus && onFocus(e);
    },
    onBlur: e => {
      setF(false);
      onBlur && onBlur(e);
    },
    style: s
  }, rest)), error ? /*#__PURE__*/React.createElement("p", {
    id: errId,
    style: {
      margin: 0,
      fontSize: 'var(--size-label)',
      fontWeight: 500,
      color: 'var(--error)',
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "!"), error) : null);
}
Object.assign(__ds_scope, { TextField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextField.jsx", error: String((e && e.message) || e) }); }

// components/illustration/Vine.jsx
try { (() => {
const PRESETS = {
  hero: {
    vb: [0, 0, 300, 600],
    par: 'xMaxYMin meet',
    stem: [[250, 0], [330, 170], [60, 260], [150, 590]],
    n: 11,
    size: 58,
    seed: 2
  },
  how: {
    vb: [0, 0, 240, 150],
    par: 'xMaxYMax meet',
    stem: [[232, 152], [205, 90], [120, 40], [16, 34]],
    n: 6,
    size: 36,
    seed: 5
  },
  contact: {
    vb: [0, 0, 400, 400],
    par: 'xMinYMax meet',
    stem: [[40, 404], [18, 250], [250, 250], [270, 30]],
    n: 10,
    size: 56,
    seed: 3
  },
  faq: {
    vb: [0, 0, 360, 460],
    par: 'xMinYMax meet',
    stem: [[0, 150], [170, 80], [110, 380], [330, 470]],
    n: 9,
    size: 44,
    seed: 4,
    startT: 0.06
  },
  about: {
    vb: [0, 0, 340, 420],
    par: 'xMaxYMax meet',
    stem: [[330, 424], [345, 250], [70, 300], [110, 20]],
    n: 10,
    size: 54,
    seed: 6
  }
};
function Vine({
  preset = 'hero',
  animate = true,
  delay = 0,
  style,
  ...custom
}) {
  const c = {
    n: 8,
    size: 46,
    seed: 1,
    startT: 0.1,
    par: 'xMaxYMin meet',
    ...(PRESETS[preset] || PRESETS.hero),
    ...custom
  };
  const ref = React.useRef(null);
  const [on, setOn] = React.useState(!animate);
  React.useEffect(() => {
    if (!animate) return;
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) {
        setOn(true);
        io.disconnect();
      }
    }, {
      threshold: 0.15
    });
    io.observe(el);
    const fb = setTimeout(() => setOn(true), 1500);
    return () => {
      io.disconnect();
      clearTimeout(fb);
    };
  }, [animate]);
  const [p0, p1, p2, p3] = c.stem;
  const B = t => {
    const u = 1 - t;
    return [0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
  };
  const D = t => {
    const u = 1 - t;
    return [0, 1].map(k => 3 * u * u * (p1[k] - p0[k]) + 6 * u * t * (p2[k] - p1[k]) + 3 * t * t * (p3[k] - p2[k]));
  };
  let r = c.seed * 9301 + 49297;
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const leaf = (x, y, ang, s, color, t, key) => /*#__PURE__*/React.createElement("g", {
    key: key,
    transform: 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')'
  }, /*#__PURE__*/React.createElement("g", {
    style: {
      transform: on ? 'scale(1)' : 'scale(0)',
      transition: 'transform .8s cubic-bezier(.3,1.35,.5,1) ' + (delay + 0.25 + t * 1.5).toFixed(2) + 's'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: 'M0 0C' + s * .25 + ' ' + -s * .33 + ' ' + s * .7 + ' ' + -s * .36 + ' ' + s + ' 0C' + s * .7 + ' ' + s * .36 + ' ' + s * .25 + ' ' + s * .33 + ' 0 0Z',
    fill: color
  }), /*#__PURE__*/React.createElement("path", {
    d: 'M' + s * .1 + ' 0L' + s * .78 + ' 0',
    stroke: "var(--bg)",
    strokeOpacity: 0.4,
    strokeWidth: 1.2,
    strokeLinecap: "round",
    fill: "none"
  })));
  const leaves = [];
  for (let i = 0; i < c.n; i++) {
    const t = c.startT + i / Math.max(1, c.n - 1) * (0.94 - c.startT);
    const [x, y] = B(t),
      [dx, dy] = D(t),
      side = i % 2 ? 1 : -1;
    const ang = Math.atan2(dy, dx) * 180 / Math.PI + side * (42 + rnd() * 22);
    const s = c.size * (1 - 0.4 * t) * (0.82 + rnd() * 0.32);
    leaves.push(leaf(x, y, ang, s, 'var(--leaf-' + (1 + (i + c.seed) % 3) + ')', t, i));
  }
  const [tx, ty] = B(1),
    [ex, ey] = D(1);
  leaves.push(leaf(tx, ty, Math.atan2(ey, ex) * 180 / Math.PI, c.size * 0.42, 'var(--leaf-2)', 1, 'tip'));
  return /*#__PURE__*/React.createElement("svg", {
    ref: ref,
    "aria-hidden": "true",
    viewBox: c.vb.join(' '),
    preserveAspectRatio: c.par,
    width: "100%",
    height: "100%",
    style: {
      overflow: 'visible',
      display: 'block',
      pointerEvents: 'none',
      ...style
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: 'M' + p0 + 'C' + p1 + ' ' + p2 + ' ' + p3,
    fill: "none",
    stroke: "var(--stem)",
    strokeWidth: 2.5,
    strokeLinecap: "round",
    pathLength: 1,
    strokeDasharray: 1,
    strokeDashoffset: on ? 0 : 1,
    style: {
      transition: 'stroke-dashoffset 1.9s cubic-bezier(.4,0,.2,1) ' + delay + 's'
    }
  }), leaves);
}
Object.assign(__ds_scope, { Vine });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/illustration/Vine.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SiteFooter.jsx
try { (() => {
const ICONS = {
  portfolio: /*#__PURE__*/React.createElement("svg", {
    "aria-hidden": "true",
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 21c0-4 3.6-7 8-7s8 3 8 7"
  })),
  github: /*#__PURE__*/React.createElement("svg", {
    "aria-hidden": "true",
    width: "20",
    height: "20",
    viewBox: "0 0 16 16",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
  })),
  linkedin: /*#__PURE__*/React.createElement("svg", {
    "aria-hidden": "true",
    width: "19",
    height: "19",
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.88 1.64-1.8 3.37-1.8 3.6 0 4.27 2.37 4.27 5.46v6.23zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"
  }))
};
const DEFAULT_LINKS = [{
  icon: 'portfolio',
  label: 'Portfolio',
  href: 'https://portfolio.didi.build'
}, {
  icon: 'github',
  label: 'GitHub',
  href: 'https://github.com/DiademShoukralla/'
}, {
  icon: 'linkedin',
  label: 'LinkedIn',
  href: 'https://www.linkedin.com/in/diadem-shoukralla/'
}];
function SiteFooter({
  year = new Date().getFullYear(),
  links = DEFAULT_LINKS
}) {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      borderTop: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container)',
      margin: '0 auto',
      padding: '32px var(--gutter) 40px',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-muted)',
      fontSize: 'var(--size-label)'
    }
  }, "\xA9 ", year)), /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Elsewhere"
  }, /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      padding: 0,
      listStyle: 'none',
      display: 'flex',
      gap: 4
    }
  }, links.map(l => /*#__PURE__*/React.createElement("li", {
    key: l.label
  }, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    variant: "ghost",
    label: l.label,
    href: l.href
  }, ICONS[l.icon])))))));
}
Object.assign(__ds_scope, { SiteFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SiteFooter.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SiteHeader.jsx
try { (() => {
function SiteHeader({
  theme = 'light',
  onToggleTheme,
  ctaHref = '#contact',
  onCta,
  ctaLabel = 'Book a chat',
  logoHref = '#'
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      maxWidth: 'var(--container)',
      margin: '0 auto',
      padding: '20px var(--gutter)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    href: logoHref
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.ThemeToggle, {
    theme: theme,
    onToggle: onToggleTheme
  }), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "outline",
    size: "sm",
    href: ctaHref,
    onClick: onCta
  }, ctaLabel)));
}
Object.assign(__ds_scope, { SiteHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SiteHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/sections.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// didi.build sections, composed from the design system. Requires window.DS.
const FAQS = [{
  q: 'How can AI help my small business grow?',
  a: 'Mostly by giving you back time. AI can sort and answer inquiries, pull details out of paperwork, and draft replies, so you and your team spend more of the day on customers.'
}, {
  q: 'Do I need technical staff to use what you build?',
  a: 'No. I build it to fit the tools you already use and walk you and your team through it in plain English.'
}, {
  q: 'How much does it cost?',
  a: 'The first 30-minute chat is free. Before any work starts, you get a written plan with one fixed price, and that is what you pay.'
}, {
  q: 'How long does a project take?',
  a: 'It depends on the scope. You will know the timeline before we start, because it is in the written plan along with the price.'
}, {
  q: 'Is my business data safe?',
  a: 'Your data is only used for the work you asked for, and access is limited to you and your team.'
}, {
  q: 'Do you only work in Toronto?',
  a: 'I am based in Toronto, but most of the work happens over video calls and email, so I can work with businesses anywhere.'
}, {
  q: "What if AI isn't a good fit for us?",
  a: "Then I'll tell you. The first chat is free with no obligation."
}];
const EXAMPLES = [{
  title: 'Never lose a lead',
  body: 'New inquiries from your website, email, or social messages get sorted, summarized, and followed up, even on your busiest days.'
}, {
  title: 'Paperwork that reads itself',
  body: 'Invoices, intake forms, and applications. The key details get pulled out and put where they belong, with no retyping.'
}, {
  title: 'Answers from your own documents',
  body: 'A private assistant that knows your policies, pricing, and procedures, so you and your team can simply ask.'
}, {
  title: 'A calmer inbox',
  body: 'Customer emails get sorted by what needs you first, with replies drafted in your voice for you to check and send.'
}];
const STEPS = [{
  title: 'A free 30-minute chat',
  body: "We talk about how your business runs and where the time goes. No prep needed. If AI isn't a good fit, I'll tell you."
}, {
  title: 'A fixed-price, fixed-scope build',
  body: "Before any work starts, you get a written plan and one price. That's what you pay, so there are no surprise bills."
}, {
  title: 'Support, if you want it',
  body: 'Once it is running, choose a simple monthly plan or pay only when you need something. Either works.'
}];
const wrap = {
  maxWidth: 'var(--container)',
  margin: '0 auto',
  padding: 'var(--section-y) var(--gutter)'
};
const muted = {
  color: 'var(--ink-muted)',
  textWrap: 'pretty'
};
function Hero({
  onCta,
  onHow
}) {
  const {
    Heading,
    Button,
    Chip,
    Vine
  } = window.DS;
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": "Hero",
    style: {
      position: 'relative',
      maxWidth: 'var(--container)',
      margin: '0 auto',
      padding: 'var(--hero-top) var(--gutter) var(--hero-bottom)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      top: 0,
      right: 'clamp(0px,2cqi,24px)',
      width: 'clamp(120px,32cqi,420px)',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement(Vine, {
    preset: "hero",
    delay: 0.2
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      paddingRight: 'clamp(110px,28cqi,400px)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 24px',
      fontSize: 'var(--type-lead-size)',
      fontWeight: 600
    }
  }, "Hi, I'm Didi. ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500,
      color: 'var(--ink-muted)'
    }
  }, "A software engineer in Toronto.")), /*#__PURE__*/React.createElement(Heading, {
    level: "display",
    sub: "I find where it fits in your business, then I build it."
  }, "AI that saves you time or makes you money."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '28px 0 0',
      maxWidth: 'var(--measure-lead)',
      fontSize: 'var(--type-lead-size)',
      lineHeight: 'var(--type-lead-lh)',
      ...muted
    }
  }, "First I learn how your business actually runs. The tools come after that, only where they fit.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      marginTop: 36,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '16px 28px'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    icon: "arrow",
    href: "#contact",
    onClick: onCta
  }, "Book a free 30-min chat"), /*#__PURE__*/React.createElement(Button, {
    variant: "link",
    href: "#how",
    onClick: onHow
  }, "See how it works")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      marginTop: 32,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Chip, null, "Free first chat"), /*#__PURE__*/React.createElement(Chip, null, "Fixed price, fixed scope"), /*#__PURE__*/React.createElement(Chip, null, "Plain English, no jargon")));
}
function WhatIDo({
  onCta
}) {
  const {
    Eyebrow,
    Heading,
    ExampleCard
  } = window.DS;
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": "What I do",
    style: wrap
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px 64px',
      alignItems: 'end',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 420px',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "What I do"), /*#__PURE__*/React.createElement(Heading, null, "I learn how you work first, then build what fits.")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      flex: '1 1 340px',
      maxWidth: 'var(--measure-body)',
      ...muted
    }
  }, "Every business runs a little differently, so I don't sell packages. Here are a few examples of what that has looked like.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--block-gap)',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,250px),1fr))',
      gap: 16
    }
  }, EXAMPLES.map((e, i) => /*#__PURE__*/React.createElement(ExampleCard, {
    key: i,
    n: i + 1,
    title: e.title
  }, e.body))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '28px 0 0',
      color: 'var(--ink-muted)'
    }
  }, "Have something else in mind? ", /*#__PURE__*/React.createElement("a", {
    href: "#contact",
    onClick: onCta,
    style: {
      fontWeight: 600
    }
  }, "Tell me about it.")));
}
function HowItWorks() {
  const {
    Eyebrow,
    Heading,
    Step,
    Vine
  } = window.DS;
  return /*#__PURE__*/React.createElement("section", {
    id: "how",
    "data-screen-label": "How it works",
    style: {
      position: 'relative',
      background: 'var(--surface-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      right: '6%',
      bottom: 'calc(100% - 4px)',
      width: 'clamp(90px,18cqi,230px)',
      aspectRatio: '240/150'
    }
  }, /*#__PURE__*/React.createElement(Vine, {
    preset: "how"
  })), /*#__PURE__*/React.createElement("div", {
    style: wrap
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "How it works"), /*#__PURE__*/React.createElement(Heading, {
    style: {
      maxWidth: '20ch'
    }
  }, "Three steps, and you always know what comes next.")), /*#__PURE__*/React.createElement("ol", {
    style: {
      margin: 'var(--block-gap) 0 0',
      padding: 0,
      listStyle: 'none',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))',
      gap: 'clamp(28px,4cqi,48px)'
    }
  }, STEPS.map((s, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement(Step, {
    n: i + 1,
    title: s.title
  }, s.body))))));
}
function Contact() {
  const {
    Eyebrow,
    Heading,
    TextField,
    Button,
    Alert,
    Vine
  } = window.DS;
  const [v, setV] = React.useState({
    name: '',
    email: '',
    business: '',
    website: '',
    message: ''
  });
  const [tried, setTried] = React.useState(false);
  const [status, setStatus] = React.useState('idle');
  const errs = {};
  if (!v.name.trim()) errs.name = 'Please enter your name.';
  if (!v.email.trim()) errs.email = 'Please enter your email so I can reply.';else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) errs.email = "That email doesn't look quite right. Check for a typo?";
  if (!v.message.trim()) errs.message = "Tell me a little about what you'd like help with.";
  const n = Object.keys(errs).length;
  const bind = k => ({
    value: v[k],
    onChange: e => setV({
      ...v,
      [k]: e.target.value
    }),
    error: tried ? errs[k] : undefined
  });
  const submit = e => {
    e.preventDefault();
    setTried(true);
    if (n) return;
    setStatus('sending');
    setTimeout(() => setStatus('success'), 1000);
  };
  return /*#__PURE__*/React.createElement("section", {
    id: "contact",
    "data-screen-label": "Contact",
    style: {
      ...wrap,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--column-gap)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 320px',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Book a free 30-min chat"), /*#__PURE__*/React.createElement(Heading, {
    style: {
      maxWidth: 'none'
    }
  }, "Tell me about your business."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      maxWidth: 'var(--measure-lead)',
      ...muted
    }
  }, "What you do, and what's taking up more time than it should. I'll reply within 2 business days to find a time to talk."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--ink-muted)'
    }
  }, "Prefer email? ", /*#__PURE__*/React.createElement("a", {
    href: "mailto:hello@didi.build",
    style: {
      fontWeight: 600
    }
  }, "hello@didi.build")), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      marginTop: 12,
      flex: '1 1 auto',
      minHeight: 200,
      maxHeight: 420
    }
  }, /*#__PURE__*/React.createElement(Vine, {
    preset: "contact"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1.3 1 440px',
      minWidth: 0
    }
  }, status === 'success' ? /*#__PURE__*/React.createElement(Alert, {
    variant: "success",
    title: "Thanks! I'll get back to you within 2 business days.",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "md",
      onClick: () => {
        setStatus('idle');
        setTried(false);
        setV({
          name: '',
          email: '',
          business: '',
          website: '',
          message: ''
        });
      }
    }, "Send another message")
  }) : /*#__PURE__*/React.createElement("form", {
    noValidate: true,
    onSubmit: submit,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, tried && n ? /*#__PURE__*/React.createElement("p", {
    role: "alert",
    style: {
      margin: 0,
      fontSize: 16,
      fontWeight: 600,
      color: 'var(--error)'
    }
  }, n === 1 ? 'One field needs a fix before sending.' : n + ' fields need a fix before sending.') : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))',
      gap: '20px 14px'
    }
  }, /*#__PURE__*/React.createElement(TextField, _extends({
    label: "Your name",
    autoComplete: "name"
  }, bind('name'))), /*#__PURE__*/React.createElement(TextField, _extends({
    label: "Email",
    type: "email",
    placeholder: "you@yourbusiness.com"
  }, bind('email'))), /*#__PURE__*/React.createElement(TextField, _extends({
    label: "Business name",
    optional: true
  }, bind('business'))), /*#__PURE__*/React.createElement(TextField, _extends({
    label: "Website",
    optional: true,
    placeholder: "yourbusiness.com"
  }, bind('website')))), /*#__PURE__*/React.createElement(TextField, _extends({
    label: "What would you like help with?",
    multiline: true,
    placeholder: "A few sentences about your business and what feels slow."
  }, bind('message'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    disabled: status === 'sending'
  }, status === 'sending' ? 'Sending…' : 'Send message')))));
}
function Faq() {
  const {
    Eyebrow,
    Heading,
    Accordion,
    Vine
  } = window.DS;
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": "FAQ",
    style: {
      position: 'relative',
      background: 'var(--surface-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrap,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--column-gap)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 320px',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "FAQ"), /*#__PURE__*/React.createElement(Heading, {
    style: {
      maxWidth: '16ch'
    }
  }, "Straight answers to common questions."), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: 'relative',
      flex: '1 1 auto',
      minHeight: 0,
      maxHeight: 'clamp(0px,(100cqi - 760px) * 100,4000px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 24,
      right: 0,
      bottom: 'calc(-1 * var(--section-y) - 28px)',
      left: 'calc(-1 * var(--gutter) - clamp(0px,(100cqi - 1168px) / 2,150px))'
    }
  }, /*#__PURE__*/React.createElement(Vine, {
    preset: "faq"
  })))), /*#__PURE__*/React.createElement(Accordion, {
    items: FAQS,
    style: {
      flex: '1.3 1 440px',
      minWidth: 0
    }
  })));
}
function About() {
  const {
    Eyebrow,
    Heading,
    SoftPanel,
    Vine
  } = window.DS;
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": "About",
    style: {
      maxWidth: 'var(--container)',
      margin: '0 auto',
      padding: 'clamp(72px,10cqi,128px) var(--gutter) clamp(56px,7cqi,88px)'
    }
  }, /*#__PURE__*/React.createElement(SoftPanel, {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'clamp(24px,5cqi,64px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: '1 1 440px',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    mark: true
  }, "About me"), /*#__PURE__*/React.createElement(Heading, {
    level: "feature"
  }, "A software engineer building custom AI for small businesses."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      maxWidth: '52ch',
      fontSize: 'clamp(1.0625rem,1rem + .3cqi,1.1875rem)',
      textWrap: 'pretty'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0
    }
  }, "I'm Diadem (Didi) Shoukralla, a software engineer with experience across full-stack web, SDK engineering, and distributed systems."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--ink-muted)'
    }
  }, "These days I help small businesses adopt AI in ways that fit how they actually work."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--ink-muted)'
    }
  }, "Browse my ", /*#__PURE__*/React.createElement("a", {
    href: "https://portfolio.didi.build",
    style: {
      fontWeight: 600
    }
  }, "portfolio site"), " or connect on ", /*#__PURE__*/React.createElement("a", {
    href: "https://www.linkedin.com/in/diadem-shoukralla/",
    style: {
      fontWeight: 600
    }
  }, "LinkedIn"), "."))), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: 'relative',
      flex: '1 1 220px',
      maxWidth: 380,
      minHeight: 'clamp(170px,24cqi,300px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 'calc(-1 * var(--panel-pad) - clamp(56px,7cqi,88px) - 2px)',
      right: 'calc(-1 * var(--panel-pad) - var(--gutter) - clamp(0px,(100cqi - 1168px) / 2,150px))'
    }
  }, /*#__PURE__*/React.createElement(Vine, {
    preset: "about"
  })))));
}
function Site() {
  const {
    SiteHeader,
    SiteFooter
  } = window.DS;
  const sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const [theme, setTheme] = React.useState(sys);
  const go = id => e => {
    e.preventDefault();
    const el = document.getElementById(id);
    el && window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - 16,
      behavior: 'smooth'
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    "data-theme": theme,
    style: {
      containerType: 'inline-size',
      background: 'var(--bg)',
      color: 'var(--ink)',
      minHeight: '100vh',
      overflowX: 'clip',
      transition: 'background .2s, color .2s'
    }
  }, /*#__PURE__*/React.createElement(SiteHeader, {
    theme: theme,
    onToggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    onCta: go('contact')
  }), /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(Hero, {
    onCta: go('contact'),
    onHow: go('how')
  }), /*#__PURE__*/React.createElement(WhatIDo, {
    onCta: go('contact')
  }), /*#__PURE__*/React.createElement(HowItWorks, null), /*#__PURE__*/React.createElement(Contact, null), /*#__PURE__*/React.createElement(Faq, null), /*#__PURE__*/React.createElement(About, null)), /*#__PURE__*/React.createElement(SiteFooter, null));
}
window.Site = Site;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/sections.jsx", error: String((e && e.message) || e) }); }

__ds_ns.ExampleCard = __ds_scope.ExampleCard;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.Heading = __ds_scope.Heading;

__ds_ns.SoftPanel = __ds_scope.SoftPanel;

__ds_ns.Step = __ds_scope.Step;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.LeafMark = __ds_scope.LeafMark;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.ThemeToggle = __ds_scope.ThemeToggle;

__ds_ns.Accordion = __ds_scope.Accordion;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.TextField = __ds_scope.TextField;

__ds_ns.Vine = __ds_scope.Vine;

__ds_ns.SiteFooter = __ds_scope.SiteFooter;

__ds_ns.SiteHeader = __ds_scope.SiteHeader;

})();
