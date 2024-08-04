Veloria is a SQLite-based ORM that aims to bring prisma-like experience for React Native.

# Foreword

The initial announcement of [Prisma for React Native](https://www.prisma.io/blog/bringing-prisma-orm-to-react-native-and-expo) made me very excited to try it out on a new project. I watched a few [videos](https://www.youtube.com/watch?v=65Iqes0lxpQ) and decided to give it a spin. Unfortunately, I faced quite a few issues (for example, [this one](https://github.com/prisma/react-native-prisma/issues/30)) running the project and wasn't able overcome them within reasonable timeframe.

But the idea was great! I use Prisma for my web projects and can't get enough of it, so I thought I can invest some time and efforts to build a similar library that will work for me and hopefully for you. Probably, at some point prisma will invest more resources to develop the react-native-prisma library to the point where my lib won't be needed, but until then, I'm happy to bridge this gap by veloria.

This library is built with the sole purpose of bringing similar to prisma experience to React Native so developers like myself can relate to it and build upon it. I'm happy to develop this library with you for our common needs.

I would like to keep the DX as close as possible to Prisma (so eventually it can superseed this project and developers won't have to rewrite the entire codebase if they decide to migrate). However, there are some delibirate differences that I introduced based on my personal likings. Later on, we can make it customizable by introducing pluggable templates if that's what community would prefer.

# Getting Started (Expo)

1. Add `prisma.schema` to your `assets` folder. You can also use any other folder, but then you'd have to provide an optional path to the `prisma.schema` in all your commands
2. Add expo-sqlite to your project: `bun expo install expo-sqlite`. We rely on `expo-sqlite` as a solid foundation for managing database layer, so you need to install it first
3. Run `bunx veloria migrate`. This command will generate the initial migration for your database based on the `prisma.schema` provided
4. Generate hooks and types by using `bunx veloria generate`

Now you are all set to use veloria in your project:

1. Add `import { DatabaseProvider } from '@veloria/client'` in your `app/_layout.tsx`
2. Wrap your content into `<DatabaseProvider />`:

```tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import 'react-native-reanimated'

import { useColorScheme } from '@/hooks/useColorScheme'
import { DatabaseProvider } from '@veloria/client'

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  })

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync()
    }
  }, [loaded])

  if (!loaded) {
    return null
  }

  return (
    <DatabaseProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ThemeProvider>
    </DatabaseProvider>
  )
}
```

Assuming you have a simple schema like this:

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Test {
  id   Int    @id @default(autoincrement())
  name String
}
```

you should be able to use auto-generated hooks for simple CRUD operations:

```tsx
import { useTest } from '@veloria/client'
// ...
export default function HomeScreen() {
  const [tests, setTests] = useState<Test[]>([])
  const test = useTest()

  useEffect(() => {
    test.list().then(setTests)
  }, [])

  useEffect(() => {
    console.log('Current tests look like this: ', tests)
  }, [tests])

  //...

  return (
    <View>
      <TouchableOpacity
          onPress={async () => {
            const res = test.create({
              name: 'test ' + Math.random().toString(36).substring(7),
            })
          }}
        >
          <ThemedText>Create a test</ThemedText>
      </TouchableOpacity>
    </View>
  )
```

This code should be sufficient to illustrate a simple workflow with veloria.

# WARNING

This library **IS NOT READY FOR PRODUCTION**:

- Plenty features are missing! Current codebase brings approx 30% of all the features that prisma provides
- Code is not covered with tests! Things might break in the future (and likely will)
- At the moment, I'm the only one who maintains this library. If I won't have time, there is a solid chance no one will step in to answer your issues and merge your PRs

**However**, if you'd like to contribute to bring more features, help this project to mature and evolve, this is the perfect opportunity to get invoived.

# Contributing

- Open an issue and outline your proposal or submit a bug
- If you think it will be better to talk in DMs, [hit me up on X](https://x.com/kureevalexey) or [DM me in Telegram](https://t.me/kureev)
