const ZERO_RECT: DOMRect = {
  width: 0,
  height: 0,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  x: 0,
  y: 0,
  toJSON() {
    return this;
  },
};

// happy-dom no calcula layout real: getBoundingClientRect() devuelve todo a
// cero por defecto. Se simula un rect no-nulo para que isVisible() en el
// extractor pueda evaluarse en los tests con un motor de layout — pero solo
// para elementos cuyo documento tiene una ventana asociada (defaultView),
// igual que en un navegador real. Un documento suelto de DOMParser (como el
// de un archivo subido) no tiene defaultView ni layout, y debe seguir
// devolviendo un rect vacío. isConnected NO sirve aquí: es true para
// cualquier nodo cuya raíz sea un Document, incluido uno de DOMParser sin
// ventana ni layout.
Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
  if (!this.ownerDocument?.defaultView) return ZERO_RECT;
  return {
    width: 100,
    height: 20,
    top: 0,
    left: 0,
    bottom: 20,
    right: 100,
    x: 0,
    y: 0,
    toJSON() {
      return this;
    },
  };
};
