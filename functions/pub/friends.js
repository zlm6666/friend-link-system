// functions/pub/friends.js
import { onRequestGet as _get, onRequestPost as _post, onRequestOptions as _opt } from '../api/links-qexo.js';

export const onRequestGet = async (ctx) => _get(ctx);
export const onRequestPost = async (ctx) => _post(ctx);
export const onRequestOptions = async (ctx) => _opt(ctx);