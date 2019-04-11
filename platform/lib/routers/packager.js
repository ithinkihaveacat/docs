/**
 * Copyright 2018 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const express = require('express');
const config = require('../config.js');
const HttpProxy = require('http-proxy');
const fetch = require('node-fetch');

const packagerProxy = new HttpProxy();

// eslint-disable-next-line new-cap
const packagerRouter = express.Router();
const proxyOptions = {
  target: config.hosts.packager.base,
};

/**
 * Proxy SXG requests to the AMPPackager:
 *
 * - If the URL starts with /amppkg/, forward the request unmodified.
 * - If the URL points to an AMP page and the AMP-Cache-Transform request header is present,
 *   rewrite the URL by prepending /priv/doc and forward the request.
 *
 * See https://github.com/ampproject/amppackager#productionizing
 */
packagerRouter.use(async (request, response, next) => {
  if (request.path.startsWith('/amppkg/')) {
    return proxy(request, response, proxyOptions.target + request.url, next).catch(e => {
      console.log("[packager] proxy error: ", e.message);
      next(e)
    });

    //packagerProxy.web(request, response, proxyOptions, next);
    return;
  }
  if (!request.path.endsWith('.amp.html')) {
    next();
    return;
  }
  if (!request.header('amp-cache-transform')) {
    next();
    return;
  }
  const url = new URL('/priv/doc', proxyOptions.target);
  // hard code amp.dev as it has to match the cert
  url.searchParams.set('sign', 'https://amp.dev' + request.originalUrl);
  request.url = url.pathname + url.search;
  return proxy(request, response, url.toString(), next).catch(e => {
    console.log("[packager] proxy error: ", e.message);
    next(e);
  });
  //packagerProxy.web(request, response, proxyOptions, next);
});

async function proxy(request, response, url, next) {
  console.log('[packager] proxy', url, request.headers);
  const fetchResponse = await fetch(url, {headers: request.headers});
  if (!fetchResponse.ok) {
    response.status(fetchResponse.status).send('amp packager request failed');
    return;
  }
  console.log('[packager] response status', fetchResponse.status);
  console.log('[packager] response headers', fetchResponse.headers.raw());
  const text = await fetchResponse.text();
  for (const [key, value] of fetchResponse.headers) {
    response.set(key, value);
  }
  response.send(text);
}

module.exports = packagerRouter;
