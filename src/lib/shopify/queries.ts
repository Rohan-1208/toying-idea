export const PRODUCT_CARD_FIELDS = `
  id
  handle
  title
  productType
  tags
  availableForSale
  featuredImage {
    url
    altText
  }
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  compareAtPriceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  variants(first: 1) {
    nodes {
      id
      availableForSale
      sku
      price {
        amount
        currencyCode
      }
      compareAtPrice {
        amount
        currencyCode
      }
    }
  }
`;

export const PRODUCT_FIELDS = `
  id
  handle
  title
  description
  descriptionHtml
  vendor
  productType
  tags
  availableForSale
  featuredImage {
    url
    altText
  }
  images(first: 8) {
    nodes {
      url
      altText
    }
  }
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
    maxVariantPrice {
      amount
      currencyCode
    }
  }
  compareAtPriceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  options {
    name
    values
  }
  variants(first: 40) {
    nodes {
      id
      title
      availableForSale
      sku
      price {
        amount
        currencyCode
      }
      compareAtPrice {
        amount
        currencyCode
      }
      image {
        url
      }
      selectedOptions {
        name
        value
      }
    }
  }
`;

export const PRODUCTS_QUERY = `
  query Products($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      nodes {
        ${PRODUCT_CARD_FIELDS}
      }
    }
  }
`;

export const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      ${PRODUCT_FIELDS}
    }
  }
`;

export const COLLECTIONS_QUERY = `
  query Collections($first: Int!) {
    collections(first: $first) {
      nodes {
        id
        handle
        title
        description
      }
    }
  }
`;

export const COLLECTION_PRODUCTS_QUERY = `
  query CollectionProducts($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      id
      handle
      title
      products(first: $first) {
        nodes {
          ${PRODUCT_CARD_FIELDS}
        }
      }
    }
  }
`;

export const PRODUCT_TYPES_QUERY = `
  query ProductTypes($first: Int!) {
    products(first: $first, query: "status:active") {
      nodes {
        productType
        tags
      }
    }
  }
`;

export const CART_FRAGMENT = `
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount {
      amount
      currencyCode
    }
    totalAmount {
      amount
      currencyCode
    }
  }
  lines(first: 50) {
    nodes {
      id
      quantity
      merchandise {
        ... on ProductVariant {
          id
          title
          sku
          price {
            amount
            currencyCode
          }
          image {
            url
          }
          product {
            id
            handle
            title
            featuredImage {
              url
            }
          }
        }
      }
    }
  }
`;

export const CART_CREATE_MUTATION = `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        ${CART_FRAGMENT}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_LINES_ADD_MUTATION = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ${CART_FRAGMENT}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_LINES_UPDATE_MUTATION = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ${CART_FRAGMENT}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_LINES_REMOVE_MUTATION = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ${CART_FRAGMENT}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_QUERY = `
  query Cart($cartId: ID!) {
    cart(id: $cartId) {
      ${CART_FRAGMENT}
    }
  }
`;
