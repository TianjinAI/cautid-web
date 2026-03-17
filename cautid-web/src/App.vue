<template>
  <div id="app">
    <nav class="navbar">
      <router-link to="/">首页</router-link>
      <router-link to="/profile">方案</router-link>
    </nav>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #333;
}

.navbar {
  display: flex;
  justify-content: space-around;
  padding: 15px;
  background-color: #f8f8f8;
  border-bottom: 1px solid #eee;
}

.navbar a {
  text-decoration: none;
  color: #666;
  padding: 8px 16px;
  border-radius: 4px;
}

.navbar a.router-link-active,
.navbar a:hover {
  color: #007aff;
  background-color: #e6f0ff;
}

.main-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}
</style>