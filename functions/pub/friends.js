// functions/pub/friends.js
// Qexo 兼容路径：/pub/friends → 路由到 /api/links-qexo
import { onRequestGet as qexoGet, onRequestPost as qexoPost, onRequestOptions as qexoOptions } from '../api/links-qexo.js';

export const onRequestGet = qexoGet;
export const onRequestPost = qexoPost;
export const onRequestOptions = qexoOptions;