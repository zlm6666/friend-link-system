// functions/pub/friends.js
// Qexo 兼容路径：/pub/friends
import { onRequestGet as _get, onRequestOptions as _opt } from '../api/links-qexo.js';

export const onRequestGet = _get;
export const onRequestPost = _get;
export const onRequestOptions = _opt;