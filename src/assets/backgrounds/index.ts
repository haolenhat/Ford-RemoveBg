// Import background images
import bg1 from './1.png';
import bg2 from './2.png';
import bg3 from './3.png';
import bg4 from './4.png';
import bg5 from './5.png';
import bg6 from './6.png';

// Export background images
export const backgroundImages = {
  bg1: bg1,
  bg2: bg2,
  bg3: bg3,
  bg4: bg4,
  bg5: bg5,
  bg6: bg6,
};

// Background configurations
export const backgroundConfigs = [
  {
    id: 'none',
    name: 'Không có nền',
    thumbnail: null,
    fullSize: null
  },
  {
    id: 'blur',
    name: 'Xóa phông',
    thumbnail: null,
    fullSize: 'blur'
  },
  {
    id: 'background-1',
    name: 'Background 1',
    thumbnail: backgroundImages.bg1,
    fullSize: backgroundImages.bg1
  },
  {
    id: 'background-2',
    name: 'Background 2',
    thumbnail: backgroundImages.bg2,
    fullSize: backgroundImages.bg2
  },
  {
    id: 'background-3',
    name: 'Background 3',
    thumbnail: backgroundImages.bg3,
    fullSize: backgroundImages.bg3
  },
  {
    id: 'background-4',
    name: 'Background 4',
    thumbnail: backgroundImages.bg4,
    fullSize: backgroundImages.bg4
  },
  {
    id: 'background-5',
    name: 'Background 5',
    thumbnail: backgroundImages.bg5,
    fullSize: backgroundImages.bg5
  },
  {
    id: 'background-6',
    name: 'Background 6',
    thumbnail: backgroundImages.bg6,
    fullSize: backgroundImages.bg6
  }
];
