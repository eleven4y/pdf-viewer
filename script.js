const url = 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf';

let pdfDoc;
const pagePreLoadOffset = 100;
const pageStateTypes = {
  unfetched: 'unfetched',
  fetching: 'fetching',
  fetched: 'fetched',
};
const pagePaddings = 10;

const store = {
  document: {
    active: 1,
    count: 0,

    scale: 1,

    pagesStates: {},
    pagesSizes: {},
  },
};

const refs = {};

const countRef = document.getElementById('count');

function setCounter({ active, count, fetching = false }) {
  const { countRef } = refs;

  if (fetching) {
    countRef.innerHTML = 'Loading document ...';
    return;
  }

  countRef.innerHTML = `${active} / ${count}`;
}

function setDocumentPagesCount(count) {
  store.document.count = count;
  const pagesStates = {};
  for (let i = 1; i <= count; i++) {
    pagesStates[i] = pageStateTypes.unfetched;
  };
  store.document.pagesStates = pagesStates;
};

function setUnfetchingPage(number) {
  store.document.pagesStates[number] = pageStateTypes.unfetched;
};

function setFetchingPage(number) {
  store.document.pagesStates[number] = pageStateTypes.fetching;
};

function setFetchedPage(number) {
  store.document.pagesStates[number] = pageStateTypes.fetched;
};

function setPageSize(number, size) {
  store.document.pagesSizes[number] = size;
};

function storeDocumentRefs() {
  const countRef = document.getElementById('count');
  const documentRef = document.getElementById('document');

  if (!countRef || !documentRef) {
    return false;
  }

  refs.countRef = countRef;
  refs.documentRef = documentRef;

  return true;
};

function onWindowScroll() {
  const viewportHeight = window.innerHeight;
  const scrollTop = document.body.scrollTop;
  const { active, count, pagesStates, pagesSizes, scale } = store.document;

  if (pagesStates[active] !== pageStateTypes.fetched) {
    return;
  }

  let pageScrollTop = 0;
  Object
    .values(pagesStates)
    .forEach((pageState, index) => {
      if (pageState === pageStateTypes.fetched) {
        const number = index + 1;
        const pageSize = pagesSizes[number];
        pageScrollTop = pageScrollTop + (pageSize.height + pagePaddings) * scale;

        if (scrollTop + viewportHeight > pageScrollTop - pagePreLoadOffset) {
          const candidateNumber = number + 1;
          const candidatePageState = pagesStates[candidateNumber];

          if (candidatePageState === pageStateTypes.unfetched) {
            pdfDoc
              .getPage(candidateNumber)
              .then(onPdfPageLoad);
          }
        }
      };
    });

  const pageStartScrollTop = Object
    .values(pagesStates)
    .filter((pageState, index) => {
      const number = index + 1;
      return pageState === pageStateTypes.fetched && number < active;
    })
    .reduce((acc, _, index) => {
      const number = index + 1;
      const pageSize = pagesSizes[number];

      acc += (pageSize.height + pagePaddings) * scale;
      return acc;
    }, 0);
  const pageEndScrollTop = pageStartScrollTop + (pagesSizes[active].height + pagePaddings) * scale

  if (scrollTop < pageStartScrollTop && active > 1) {
    store.document.active = active - 1;
    setCounter({ active: active - 1, count });
  }
  
  if (scrollTop > pageEndScrollTop && active < count) {
    store.document.active = active + 1;
    setCounter({ active: active + 1, count });
  }
}

function onPdfPageRender(pageNumber) {
  const viewportHeight = window.innerHeight;
  const scrollTop = document.body.scrollTop;
  const { active, total, pagesStates, pagesSizes, scale } = store.document;
  let fetchedScrollTop = 0;

  Object
    .values(pagesStates)
    .forEach((pageState, index) => {
      if (pageState === pageStateTypes.fetched) {
        const number = index + 1;
        const pageSize = pagesSizes[number];
        fetchedScrollTop += (pageSize.height + pagePaddings) * scale;


        if (scrollTop + viewportHeight > fetchedScrollTop + pagePreLoadOffset) {
          const candidateNumber = number + 1;
          const candidatePageState = pagesStates[candidateNumber];

          if (candidatePageState !== pageStateTypes.fetched) {
            pdfDoc
              .getPage(candidateNumber)
              .then(onPdfPageLoad);
          }
        }
      }
    });
}

function onPdfPageLoad(pdfPage) {
  const { scale } = store.document;
  const { pageInfo: { pageIndex, view }, pageNumber } = pdfPage;
  const { documentRef } = refs;

  setFetchingPage(pageNumber);

  const canvas = document.createElement('canvas');
  canvas.className = `canvas canvas--${pageIndex}`;
  const canvasContext = canvas.getContext('2d');
  const viewport = pdfPage.getViewport(scale);

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  documentRef.appendChild(canvas);

  console.info(`Profile: render page: ${pageNumber}`);
  pdfPage.render({ canvasContext, viewport }).then(() => {
    console.info(`Profile: rendered page: ${pageNumber}`);
    setFetchedPage(pageNumber);
    setPageSize(pageNumber, { width: viewport.width, height: viewport.height });

    onPdfPageRender(pageNumber);
  });
};

function onPdfDocumentLoad(pdfDocument) {
  const { numPages: count } = pdfDocument;
  const { active } = store.document;

  if (!count) {
    console.warn('Load pdf document without pdf pages by url: ', url)
    return;
  }

  pdfDoc = pdfDocument;
  setCounter({ active, count })
  setDocumentPagesCount(count);

  pdfDocument
    .getPage(active)
    .then(onPdfPageLoad)
}

function onWindowLoad() {
  if (!url) {
    console.warn('Attempt to load pdf without url');
    return;
  }

  if (!window.PDFJS) {
    console.warn('Attempt to load pdf without pdfjs library v0.8.659');
    return;
  }

  const isStoredDocumentRefs = storeDocumentRefs();

  if (!isStoredDocumentRefs) {
    console.warn('Attempt to store document refs, which not existed');
    return;
  }


  setCounter({ fetching: true });

  const loadPdfDocumentTask = window.PDFJS.getDocument(url);
  loadPdfDocumentTask.then(onPdfDocumentLoad);
};

window.onload = onWindowLoad;
window.onscroll = onWindowScroll;

window.store = store;
window.refs = refs;