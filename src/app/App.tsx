import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { findComposition } from '../content';
import { diagramsOf, type Source } from '../model/diagram';
import { getSkin, skinList, type SkinId } from '../skins';
import { fontsHref } from '../skins/fonts';
import type { FontSpec } from '../skins/types';
import { usePlayerModel } from '../render/DiagramPlayer';
import { useCompositionModel } from '../render/CompositionView';
import { useTransport } from '../render/useTransport';
import { stepIndexAt } from '../timeline';
import type { TransportState } from '../timeline/transport';
import type { CompiledTimeline } from '../timeline/types';
import { usePrefersReducedMotion } from '../core/a11y';
import { S } from './strings';
import { pendingOf, shellStore, useShell } from './store';
import { flushUrlWrite, onPopState, pushUrlNow, scheduleUrlWrite } from './url-state';
import { openablesOf, resolveOpen } from './open-path';
import { OpenPanel } from './OpenPanel';
import { useShellKeys } from './keyboard';
import { useMediaQuery } from './use-media';
import { useShare } from './use-share';
import { useBrowserExport } from './use-export';
import { Gallery, GalleryDrawer } from './Gallery';
import { Stage } from './Stage';
import { Transport } from './Transport';
import { StepList } from './StepList';
import { CaptionPanel } from './CaptionPanel';
import { SourceNote } from './SourceNote';
import { StyleSwitch } from './StyleSwitch';
import { ThemeToggle } from './ThemeToggle';
import { ShareButton } from './ShareButton';
import { ExportDialog } from './ExportDialog';
import { HelpDialog } from './HelpDialog';
import './tokens.css';
import './shell.css';

const NARROW = '(max-width: 1099px)';
const UI_FONT_LINK_ID = 'ui-fonts';
const UI_FONTS: FontSpec[] = [{ family: 'BIZ UDPGothic', googleId: 'BIZ+UDPGothic', weights: [400, 700] }];

function ensureUiFonts(): void {
  if (document.getElementById(UI_FONT_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = UI_FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = fontsHref(UI_FONTS);
  document.head.appendChild(link);
}

/**
 * 様式やフォントの読み込みで Transport が作り直されるときに持ち越す状態。
 * 秒ではなく「どのステップの何割か」で持つと、タイムラインの長さが少し変わっても同じ場面に戻れる。
 */
interface Carry {
  /** テンプレートと「ひらく」の道のりを合わせた鍵 */
  templateId: string;
  mode: TransportState['mode'];
  rate: number;
  loop: boolean;
  stepIndex: number;
  frac: number;
  t: number;
}

function carryOf(templateId: string, tl: CompiledTimeline, st: TransportState): Carry {
  const i = stepIndexAt(tl, st.t);
  const s = tl.steps[i];
  if (!s || st.t < s.t0) return { templateId, mode: st.mode, rate: st.rate, loop: st.loop, stepIndex: -1, frac: 0, t: st.t };
  const len = s.t1 - s.t0;
  const frac = len > 0 ? Math.min(1, Math.max(0, (st.t - s.t0) / len)) : 0;
  return { templateId, mode: st.mode, rate: st.rate, loop: st.loop, stepIndex: i, frac, t: st.t };
}

function restoreT(tl: CompiledTimeline, c: Carry): number {
  const s = tl.steps[c.stepIndex];
  if (!s) return c.t;
  return s.t0 + c.frac * (s.t1 - s.t0);
}

type DialogId = 'none' | 'export' | 'help' | 'gallery';

function dedupeSources(xs: Source[]): Source[] {
  const seen = new Set<string>();
  return xs.filter((s) => (seen.has(s.title) ? false : (seen.add(s.title), true)));
}

export function App() {
  const browserExport = useBrowserExport();
  const { templateId, styleId, theme, postFrame, debug, pending, openPath } = useShell();
  const root = findComposition(templateId);
  const { levels, path } = useMemo(() => resolveOpen(root, openPath), [root, openPath]);
  const view = levels[levels.length - 1].composition;
  const isSingle = view.kind === 'single';
  const viewKey = `${templateId}|${path.join('/')}`;
  const openables = useMemo(() => openablesOf(view), [view]);
  const skin = getSkin(styleId);
  const diagram = isSingle ? view.diagram : diagramsOf(view)[0];
  const reduced = usePrefersReducedMotion();
  const narrow = useMediaQuery(NARROW);
  const dark = theme ? theme === 'dark' : skin.tokens.dark;

  const player = usePlayerModel(diagram, skin, postFrame ? '4:5' : 'free', !reduced);
  const multi = useCompositionModel(view, skin, !reduced);
  const transport = isSingle ? player.transport : multi.transport;
  const timeline = transport.timeline;
  const state = useTransport(transport);
  const stepIndex = Math.max(0, stepIndexAt(timeline, state.t));
  const currentStep = state.mode === 'static' ? -1 : stepIndex;

  const [dialog, setDialog] = useState<DialogId>('none');
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [viewKey]);
  const closeDialog = useCallback(() => setDialog('none'), []);

  useEffect(() => {
    ensureUiFonts();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  useEffect(
    () =>
      onPopState((u) =>
        shellStore.set({ templateId: u.t, styleId: u.style, theme: u.theme, debug: u.debug, pending: pendingOf(u), openPath: u.open }),
      ),
    [],
  );

  const carryRef = useRef<Carry | null>(null);
  useEffect(() => {
    carryRef.current = carryOf(viewKey, timeline, state);
  }, [viewKey, timeline, state]);

  useLayoutEffect(() => {
    const c = carryRef.current;
    if (!c || c.templateId !== viewKey) return;
    if (shellStore.get().pending) return;
    transport.setRate(c.rate);
    transport.setLoop(c.loop);
    transport.seek(restoreT(transport.timeline, c));
    if (c.mode === 'play') transport.play();
    else if (c.mode === 'static') transport.pause();
  }, [transport, viewKey]);

  useLayoutEffect(() => {
    if (!pending) return;
    if (pending.step != null) {
      if (pending.step <= timeline.steps.length) transport.seekStep(pending.step - 1);
    } else if (pending.at != null) {
      transport.seek(pending.at);
    }
    if (pending.static) transport.pause();
    shellStore.set({ pending: null });
  }, [pending, transport, timeline]);

  useEffect(() => {
    scheduleUrlWrite({ t: templateId, style: styleId, theme, step: state.mode === 'scrub' ? stepIndex + 1 : null, debug, open: path });
  }, [templateId, styleId, theme, debug, state.mode, stepIndex, path]);

  const openTo = useCallback(
    (next: string[]) => {
      shellStore.set({ openPath: next, pending: null });
      pushUrlNow({ t: templateId, style: styleId, theme, step: null, debug, open: next });
    },
    [templateId, styleId, theme, debug],
  );
  const openSegment = useCallback((segment: string) => openTo([...path, segment]), [openTo, path]);
  const goUp = useCallback((depth: number) => openTo(path.slice(0, Math.max(0, depth))), [openTo, path]);

  const pickTemplate = useCallback(
    (id: string) => {
      shellStore.set({ templateId: id, openPath: [], pending: null });
      setDialog('none');
    },
    [],
  );
  const pickStyle = useCallback((id: SkinId) => shellStore.set({ styleId: id }), []);
  const toggleTheme = useCallback(() => shellStore.set({ theme: dark ? 'light' : 'dark' }), [dark]);
  const setPostFrame = useCallback((on: boolean) => shellStore.set({ postFrame: on }), []);

  const getUrl = useCallback(() => {
    flushUrlWrite();
    return window.location.href;
  }, []);
  const share = useShare(getUrl);

  useShellKeys({
    togglePlay: () => (transport.getState().mode === 'play' ? transport.pause() : transport.play()),
    prevStep: () => transport.prev(),
    nextStep: () => transport.next(),
    nudge: (sec) => transport.seek(transport.getState().t + sec),
    home: () => transport.seek(0),
    end: () => transport.seekStep(timeline.steps.length - 1),
    pickStyle: (i) => {
      const s = skinList[i];
      if (s) pickStyle(s.id);
    },
    toggleTheme,
    openExport: () => setDialog('export'),
    copyUrl: () => void share.copy(),
    openHelp: () => setDialog('help'),
    close: () => {
      if (dialog !== 'none') closeDialog();
      else if (path.length > 0) goUp(path.length - 1);
    },
    up: () => {
      if (path.length > 0) goUp(path.length - 1);
    },
  });

  const sources = isSingle ? diagram.sources : dedupeSources(view.kind === 'grid' ? view.sources ?? [] : diagramsOf(view).flatMap((d) => d.sources));

  return (
    <div className="shell">
      <header className="top">
        <h1 className="top__title">{S.appTitle}</h1>
        {narrow && (
          <button type="button" className="ui-btn" onClick={() => setDialog('gallery')}>
            {S.gallery.open}
          </button>
        )}
        <StyleSwitch value={styleId} onChange={pickStyle} />
        <div className="top__group top__right">
          <ThemeToggle dark={dark} onToggle={toggleTheme} />
          <ShareButton status={share.status} url={share.url} onCopy={() => void share.copy()} />
          <button type="button" className="ui-btn" onClick={() => setDialog('export')}>
            {S.nav.export}
          </button>
          <button type="button" className="ui-btn" onClick={() => setDialog('help')}>
            {S.nav.help}
          </button>
        </div>
      </header>

      {!narrow && (
        <aside className="gallery">
          <Gallery value={templateId} onChange={pickTemplate} />
        </aside>
      )}

      <Stage
        view={view}
        levels={levels}
        path={path}
        skin={skin}
        player={player}
        multi={multi}
        openables={openables}
        onOpen={openSegment}
        onUp={goUp}
        postFrame={postFrame}
        onPostFrame={setPostFrame}
        debug={debug}
        reducedNote={reduced && state.mode !== 'play'}
        reduced={reduced}
        onPlay={() => transport.play()}
        fitWidth={narrow}
      />

      <Transport transport={transport} timeline={timeline} state={state} stepIndex={stepIndex} />

      <aside ref={panelRef} className="panel" aria-label={S.panel.title}>
        {isSingle && <StepList steps={timeline.steps} current={currentStep} onPick={(i) => transport.seekStep(i)} />}
        {isSingle && <CaptionPanel step={timeline.steps[stepIndex] ?? null} isStatic={state.mode === 'static'} />}
        <OpenPanel items={openables} multi={!isSingle} onOpen={openSegment} />
        <SourceNote sources={sources} />
      </aside>

      {narrow && <GalleryDrawer open={dialog === 'gallery'} onClose={closeDialog} value={templateId} onChange={pickTemplate} />}
      <ExportDialog
        open={dialog === 'export'}
        onClose={() => {
          browserExport.reset();
          closeDialog();
        }}
        templateId={view.id}
        styleId={styleId}
        steps={timeline.steps}
        duration={timeline.duration}
        currentT={dialog === 'export' ? state.t : 0}
        onExport={(req) => browserExport.start(req)}
        job={browserExport.job}
        onCancel={browserExport.cancel}
        onDownload={browserExport.download}
        onShare={browserExport.share}
        onRetryWithoutFonts={browserExport.retryWithoutFonts}
        canShare={browserExport.canShare}
      />
      <HelpDialog open={dialog === 'help'} onClose={closeDialog} />
    </div>
  );
}
