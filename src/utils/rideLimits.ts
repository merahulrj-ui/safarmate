import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { showAlert } from '@/utils/alert';

export const checkActiveRidesLimit = async (userId: string): Promise<boolean> => {
  try {
    const now = new Date();
    
    // Check published active rides
    const publishedQuery = query(collection(db, 'rides'), where('driverId', '==', userId));
    const publishedSnap = await getDocs(publishedQuery);
    let activePublished = 0;
    publishedSnap.forEach((doc) => {
      const data = doc.data();
      if (data.status !== 'CANCELLED') {
        const rideEndTime = new Date(data.departureDate || data.date).getTime() + (4 * 60 * 60 * 1000); // Accurate check
        if (rideEndTime >= now.getTime()) {
          activePublished++;
        }
      }
    });

    // Check booked active rides
    const bookedQuery = query(collection(db, 'rides'), where('passengerIds', 'array-contains', userId));
    const bookedSnap = await getDocs(bookedQuery);
    let activeBooked = 0;
    bookedSnap.forEach((doc) => {
      const data = doc.data();
      if (data.status !== 'CANCELLED') {
        const userBooking = data.bookings?.find((b: any) => b.passengerId === userId);
        if (userBooking && (userBooking.status === 'PENDING' || userBooking.status === 'ACCEPTED')) {
          const rideEndTime = new Date(data.departureDate || data.date).getTime() + (4 * 60 * 60 * 1000); // Accurate check
          if (rideEndTime >= now.getTime()) {
            activeBooked++;
          }
        }
      }
    });

    const totalActive = activePublished + activeBooked;

    if (totalActive >= 3) {
      showAlert('Limit Reached', 'You cannot have more than 3 active rides at a time to prevent spam. Please complete or cancel your existing rides first.');
      return false; // Limit exceeded
    }

    return true; // OK to proceed
  } catch (error) {
    showAlert('Error', 'Failed to verify active rides limit. Please check your connection.');
    return false; // Secure fallback
  }
};
