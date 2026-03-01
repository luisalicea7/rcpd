export enum EventType {
  PAGE_VIEW = "page_view",
  PRODUCT_VIEW = "product_view",
  SEARCH = "search",
  ADD_TO_CART = "add_to_cart",
  REMOVE_FROM_CART = "remove_from_cart",
  IDLE = "idle",
  CLICK = "click",
  SCROLL = "scroll",
  FILTER_CHANGE = "filter_change",
}

export interface BaseEvent {
  type: EventType;
  sessionId: string;
  timestamp: number;
}

export interface PageViewEvent extends BaseEvent {
  type: EventType.PAGE_VIEW;
  page: string;
  referrer?: string;
}

export interface ProductViewEvent extends BaseEvent {
  type: EventType.PRODUCT_VIEW;
  productId: string;
  productName: string;
  category: string;
  price: number;
  viewDuration?: number; // ms
}

export interface SearchEvent extends BaseEvent {
  type: EventType.SEARCH;
  query: string;
  resultsCount: number;
}

export interface AddToCartEvent extends BaseEvent {
  type: EventType.ADD_TO_CART;
  productId: string;
  productName: string;
  category: string;
  price: number;
  quantity: number;
}

export interface RemoveFromCartEvent extends BaseEvent {
  type: EventType.REMOVE_FROM_CART;
  productId: string;
  quantity: number;
}

export interface IdleEvent extends BaseEvent {
  type: EventType.IDLE;
  idleDuration: number; // ms
  page: string;
}

export interface ClickEvent extends BaseEvent {
  type: EventType.CLICK;
  element: string;
  page: string;
}

export interface ScrollEvent extends BaseEvent {
  type: EventType.SCROLL;
  depth: number; // 0–100
  page: string;
}

export interface FilterChangeEvent extends BaseEvent {
  type: EventType.FILTER_CHANGE;
  filter: string;
  value: string;
}

export type AppEvent =
  | PageViewEvent
  | ProductViewEvent
  | SearchEvent
  | AddToCartEvent
  | RemoveFromCartEvent
  | IdleEvent
  | ClickEvent
  | ScrollEvent
  | FilterChangeEvent;