import type { Diagram } from '../../model/diagram';
import { multimodalRag } from '../rag/multimodal';
import { flowLane } from './lane';

// 最初の版の「Multimodal RAG」を略図で描き直したもの。
// 元の版は文と画像が 1 つの埋め込みに入り、質問も無かった。画像と文は別のエンコーダで同じ空間に揃え、
// 質問を足し、答えるのは画像も読める LLM にした（Abootorabi ほか 2025、CLIP は Radford ほか 2021）。

export const firstMultimodal: Diagram = {
  id: 'first-multimodal',
  title: 'マルチモーダル RAG',
  subtitle: '画像と文を同じ空間のベクトルにして、まとめて探す',
  lanes: flowLane,
  nodes: [
    { id: 'img', kind: 'image', label: '画像', lane: 'flow', col: 0, row: 0 },
    { id: 'imgenc', kind: 'encoder', label: '画像の\nエンコーダ', lane: 'flow', col: 1, row: 0 },
    { id: 'text', kind: 'documents', label: '文', lane: 'flow', col: 0, row: 1 },
    { id: 'txtenc', kind: 'encoder', label: '文の\nエンコーダ', lane: 'flow', col: 1, row: 1 },
    { id: 'index', kind: 'vectordb', label: '共通の索引', lane: 'flow', col: 2, row: 1 },
    { id: 'user', kind: 'user', label: '質問', lane: 'flow', col: 1, row: 2 },
    { id: 'mllm', kind: 'llm', label: 'マルチモーダル\nLLM', lane: 'flow', col: 2, row: 2 },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'flow', col: 3, row: 2 },
  ],
  edges: [
    { id: 'e-img-enc', from: 'img', to: 'imgenc' },
    { id: 'e-imgenc-index', from: 'imgenc', to: 'index', fromSide: 'right', toSide: 'top' },
    { id: 'e-text-enc', from: 'text', to: 'txtenc' },
    { id: 'e-txtenc-index', from: 'txtenc', to: 'index' },
    { id: 'e-user-txtenc', from: 'user', to: 'txtenc', label: '同じエンコーダで', fromSide: 'top', toSide: 'bottom', role: 'ref' },
    { id: 'e-index-llm', from: 'index', to: 'mllm', label: '近い画像と文', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-user-llm', from: 'user', to: 'mllm', line: 'dashed' },
    { id: 'e-llm-answer', from: 'mllm', to: 'answer' },
  ],
  steps: [
    {
      n: 1,
      short: '索引',
      caption: '画像と文を、それぞれのエンコーダで同じ空間のベクトルにし、1 つの索引にしまう',
      actions: [
        { type: 'travel', particle: 'i', edges: ['e-img-enc'], payload: { kind: 'image', label: '画像' } },
        { type: 'travel', particle: 'i', edges: ['e-imgenc-index'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'end', particle: 'i', mode: 'absorb' },
        { type: 'travel', particle: 't', edges: ['e-text-enc'], payload: { kind: 'text', label: '文' } },
        { type: 'travel', particle: 't', edges: ['e-txtenc-index'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'end', particle: 't', mode: 'absorb' },
      ],
    },
    {
      n: 2,
      short: '質問',
      caption: '質問を文のエンコーダでベクトルにする',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-txtenc'], payload: { kind: 'query', label: '質問' } },
        { type: 'travel', particle: 'q2', edges: ['e-user-llm'], payload: { kind: 'query', label: '質問' } },
      ],
    },
    {
      n: 3,
      short: '検索',
      caption: '索引から質問に近いものを、画像か文かを問わずに取り出す',
      badge: { edge: 'e-index-llm', at: 0.5 },
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-txtenc-index'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'travel', particle: 'q', edges: ['e-index-llm'], payload: { kind: 'chunks', label: '画像と文', count: 3 } },
      ],
    },
    {
      n: 4,
      short: '生成',
      caption: '画像も読める LLM が、質問と取り出した画像・文から回答を書く',
      actions: [
        { type: 'merge', particles: ['q', 'q2'], at: 'mllm', into: { particle: 'p', payload: { kind: 'prompt', label: '質問と資料' } } },
        { type: 'dwell', particle: 'p', node: 'mllm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'p', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: multimodalRag.sources,
};
