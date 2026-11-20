"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

/** Interaction only: each workspace retains its own links, identity and auth. */
export function useMobileNavigation(route: string, breakpoint = 1000) {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [drawer, setDrawer] = useState<HTMLElement | null>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => { setMobile(query.matches); if (!query.matches) setOpen(false); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [breakpoint]);

  useEffect(() => { setOpen(false); }, [route]);

  useEffect(() => {
    if (!drawer) return;
    drawer.inert = mobile && !open;
    if (!mobile || !open) return;
    // Isolate the whole background, including root-level controls and portals.
    const background = new Map<HTMLElement, boolean>();
    let branch: HTMLElement = drawer;
    while (branch.parentElement && branch !== document.body) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling instanceof HTMLElement && sibling !== branch && !sibling.classList.contains("mobile-nav-backdrop")) {
          background.set(sibling, sibling.inert);
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    const previousBody = document.body.style.overflow;
    const previousHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const focusables = () => Array.from(drawer.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"))
      .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
    (focusables()[0] ?? drawer).focus();
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key !== "Tab") return;
      const items = focusables(), first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); drawer.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      for (const [element, inert] of background) element.inert = inert;
      document.body.style.overflow = previousBody;
      document.documentElement.style.overflow = previousHtml;
      if (window.matchMedia(`(max-width: ${breakpoint}px)`).matches) openerRef.current?.focus();
    };
  }, [drawer, mobile, open, breakpoint]);

  return {
    open, mobile, openerRef,
    toggle: () => setOpen(value => !value),
    close: () => setOpen(false),
    drawerProps: {
      ref: setDrawer,
      "data-mobile-navigation": "",
      tabIndex: -1,
      role: mobile && open ? "dialog" : undefined,
      "aria-modal": mobile && open ? true as const : undefined,
      "aria-label": "Workspace navigation",
      onClickCapture: (event: MouseEvent<HTMLElement>) => {
        if ((event.target as Element).closest("a[href]")) setOpen(false);
      },
    },
  };
}

export type MobileNavigation = ReturnType<typeof useMobileNavigation>;

export function NavigationOpener({ navigation, id }: { navigation: MobileNavigation; id: string }) {
  return <button ref={navigation.openerRef} className="mobile-nav-opener" type="button" onClick={navigation.toggle} aria-label="Open navigation" aria-expanded={navigation.open} aria-controls={id}>
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
  </button>;
}

export function NavigationClose({ navigation }: { navigation: MobileNavigation }) {
  return <button className="mobile-nav-close" type="button" onClick={navigation.close} aria-label="Close navigation">×</button>;
}

export function NavigationBackdrop({ navigation }: { navigation: MobileNavigation }) {
  return navigation.open && navigation.mobile ? <button type="button" className="mobile-nav-backdrop" onClick={navigation.close} tabIndex={-1} aria-label="Dismiss navigation" /> : null;
}
