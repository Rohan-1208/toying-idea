import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { AdminAuthProvider } from "./context/AdminAuth";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";

const Home = lazy(() => import("./pages/Home"));
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderConfirmed = lazy(() => import("./pages/OrderConfirmed"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const PYOT = lazy(() => import("./pages/PYOT"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Careers = lazy(() => import("./pages/Careers"));
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

              <Route element={<Layout />}>
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:slug" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/order-confirmed" element={<OrderConfirmed />} />
                <Route path="/track" element={<TrackOrder />} />
                <Route path="/pyot" element={<PYOT />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/careers" element={<Careers />} />
                <Route path="/gifting" element={<Navigate to="/shop" replace />} />
                <Route path="/collections" element={<Navigate to="/shop" replace />} />
                <Route path="*" element={<NotFound />} />
              </Route>

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
