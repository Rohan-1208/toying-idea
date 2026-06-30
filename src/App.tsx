import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { AdminAuthProvider } from "./context/AdminAuth";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";

// Heavy / route-split chunks
const Home = lazy(() => import("./pages/Home"));
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderConfirmed = lazy(() => import("./pages/OrderConfirmed"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const PYOT = lazy(() => import("./pages/PYOT"));
const Gifting = lazy(() => import("./pages/Gifting"));
const Collections = lazy(() => import("./pages/Collections"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const NotFound = lazy(() => import("./pages/NotFound"));

const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminInquiries = lazy(() => import("./pages/admin/AdminInquiries"));

function Fallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-cream">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <CartProvider>
          <Suspense fallback={<Fallback />}>
            <Routes>
              <Route path="/" element={<Home />} />

              {/* Storefront (with navbar + footer) */}
              <Route element={<Layout />}>
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:slug" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/order-confirmed" element={<OrderConfirmed />} />
                <Route path="/track" element={<TrackOrder />} />
                <Route path="/pyot" element={<PYOT />} />
                <Route path="/gifting" element={<Gifting />} />
                <Route path="/collections" element={<Collections />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="*" element={<NotFound />} />
              </Route>

              {/* Admin */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="inquiries" element={<AdminInquiries />} />
              </Route>
            </Routes>
          </Suspense>
        </CartProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
